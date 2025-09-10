const Asset = require('../models/Asset');
const asyncHandler = require('express-async-handler');
const Employee = require('../models/Employee');
const Requisition = require('../models/Requisition');
const mongoose = require('mongoose');
const PTR = require('../models/PTR'); // Import the new PTR model
const { uploadToS3, generatePresignedUrl, s3, DeleteObjectCommand } = require('../lib/s3.js');
const { Readable } = require('stream');

// Replaces the original getAssets to support server-side pagination, sorting, and filtering.
const getAssets = async (req, res) => {
  try {
    const { // No defaults for page and limit, so we can check if they exist
      page,
      limit,
      sort = 'propertyNumber',
      order = 'asc',
      search,
      category,
      status,
      office,
      assignment,
      fundSource,
      startDate,
      endDate,
    } = req.query;

    // 1. Build the filter query
    const query = {};

    if (search) {
      const searchRegex = new RegExp(search, 'i'); // 'i' for case-insensitive
      query.$or = [
        { propertyNumber: searchRegex },
        { description: searchRegex },
        { 'custodian.name': searchRegex },
      ];
    }

    if (category) query.category = category;
    if (status) query.status = status;
    if (office) query.office = office;
    if (fundSource) query.fundSource = fundSource;

    if (assignment) {
        if (assignment === 'unassigned') {
            query.assignedPAR = { $in: [null, ''] };
            query.assignedICS = { $in: [null, ''] };
        } else if (assignment === 'par') {
            query.assignedPAR = { $ne: null, $ne: '' };
        } else if (assignment === 'ics') {
            query.assignedICS = { $ne: null, $ne: '' };
        }
    }

    if (startDate || endDate) {
      query.acquisitionDate = {};
      if (startDate) query.acquisitionDate.$gte = new Date(startDate);
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setUTCHours(23, 59, 59, 999); // Ensure the entire day is included
        query.acquisitionDate.$lte = endOfDay;
      }
    }

    // 2. Build the sort options
    const sortOptions = { [sort]: order === 'asc' ? 1 : -1 };

    // 3. Check if pagination is requested
    if (page && limit) {
      // Pagination logic
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 20;
      const skip = (pageNum - 1) * limitNum;

      // Using Promise.all to run queries concurrently for better performance.
      // This now includes the total value calculation.
      const [assets, totalDocs, summaryResult] = await Promise.all([
        Asset.find(query).sort(sortOptions).skip(skip).limit(limitNum).lean(),
        Asset.countDocuments(query),
        Asset.aggregate([
            { $match: query },
            { $group: { _id: null, totalValue: { $sum: '$acquisitionCost' } } }
        ])
      ]);

      const totalValue = summaryResult[0]?.totalValue || 0;

      // Send the structured paginated response
      res.json({
        docs: assets,
        totalDocs,
        totalValue,
        limit: limitNum,
        totalPages: Math.ceil(totalDocs / limitNum),
        page: pageNum,
      });
    } else {
      // No pagination, return all matching assets but in a consistent format.
      const [assets, summaryResult] = await Promise.all([
          Asset.find(query).sort(sortOptions).lean(),
          Asset.aggregate([
              { $match: query },
              { $group: { _id: null, totalValue: { $sum: '$acquisitionCost' } } }
          ])
      ]);
      const totalValue = summaryResult[0]?.totalValue || 0;

      // Return a response object consistent with the paginated one.
      res.json({ docs: assets, totalDocs: assets.length, totalValue, limit: assets.length, totalPages: 1, page: 1 });
    }
  } catch (error) {
    console.error('Error in getAssets:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

const getAssetById = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id).lean();
    if (asset) {
        // Generate pre-signed URLs for attachments before sending
        if (asset.attachments && asset.attachments.length > 0) {
            asset.attachments = await Promise.all(
                asset.attachments.map(async (att) => ({
                    ...att,
                    url: await generatePresignedUrl(att.key)
                }))
            );
        }
        res.json(asset);
    } else {
        res.status(404).json({ message: 'Asset not found' });
    }
  } catch (error) { res.status(500).json({ message: 'Server Error' }); }
};

const createAsset = async (req, res) => {
  try {
    // Since we are using multipart/form-data, nested objects might be stringified.
    const assetData = { ...req.body };

    // Safely parse fields that are expected to be JSON strings from FormData
    const fieldsToParse = ['custodian', 'specifications'];
    for (const field of fieldsToParse) {
        if (assetData[field] && typeof assetData[field] === 'string') {
            try {
                assetData[field] = JSON.parse(assetData[field]);
            } catch (e) {
                // This indicates a malformed request from the client.
                console.error(`Error parsing JSON for field '${field}':`, assetData[field]);
                res.status(400);
                throw new Error(`Invalid data format for ${field}.`);
            }
        }
    }

    // Add the initial history entry
    const assetToCreate = {
        ...assetData,
        history: [{
            event: 'Created',
            details: `Asset created with Property Number ${assetData.propertyNumber}.`,
            user: req.user.name // Use authenticated user
        }]
    };
    const asset = new Asset(assetToCreate);
    const createdAsset = await asset.save();

    // --- Handle File Uploads ---
    if (req.files && req.files.length > 0) {
        const attachmentTitles = req.body.attachmentTitles ? JSON.parse(req.body.attachmentTitles) : [];
        const uploadPromises = req.files.map((file, index) =>
            uploadToS3(file, createdAsset._id, attachmentTitles[index] || file.originalname, 'movable-assets')
        );
        const uploadedAttachments = await Promise.all(uploadPromises);
        createdAsset.attachments.push(...uploadedAttachments);
        createdAsset.history.push({ event: 'Updated', details: `${uploadedAttachments.length} file(s) attached.`, user: req.user.name });
        await createdAsset.save();
    }

    res.status(201).json(createdAsset);
  } catch (error) {
    if (error.code === 11000 && error.keyPattern && error.keyPattern.propertyNumber) {
        return res.status(400).json({ message: `Property Number '${error.keyValue.propertyNumber}' already exists.` });
    }
    console.error("Error in createAsset:", error); // Log the full error for better debugging
    res.status(400).json({ message: 'Invalid asset data', error: error.message });
  }
};

/**
 * Helper function to compare fields and generate history logs for movable assets.
 */
const generateMovableAssetUpdateHistory = (original, updates, user) => {
    const historyEntries = [];
    const user_name = user.name;

    const format = (value, field) => {
        if (value instanceof Date) return new Date(value).toLocaleDateString('en-CA');
        if (['acquisitionCost', 'salvageValue'].includes(field) && typeof value === 'number') {
            return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
        }
        if (value === null || value === undefined || value === '') return 'empty';
        return `"${value}"`;
    };

    const compareAndLog = (field, fieldName) => {
        if (updates[field] === undefined) return;

        const originalValue = original[field];
        const updatedValue = updates[field];

        // Handle date comparison
        if (originalValue instanceof Date) {
            if (new Date(originalValue).toISOString().split('T')[0] !== new Date(updatedValue).toISOString().split('T')[0]) {
                historyEntries.push({ event: 'Updated', details: `${fieldName} changed from ${format(originalValue, field)} to ${format(new Date(updatedValue), field)}.`, user: user_name });
            }
            return;
        }

        // Handle numeric comparison
        if (typeof originalValue === 'number' && parseFloat(originalValue) !== parseFloat(updatedValue)) {
            historyEntries.push({ event: 'Updated', details: `${fieldName} changed from ${format(originalValue, field)} to ${format(parseFloat(updatedValue), field)}.`, user: user_name });
            return;
        }

        // Default string comparison
        if (String(originalValue ?? '') !== String(updatedValue ?? '')) {
            historyEntries.push({ event: 'Updated', details: `${fieldName} changed from ${format(originalValue, field)} to ${format(updatedValue, field)}.`, user: user_name });
        }
    };

    // Compare core fields
    compareAndLog('description', 'Description');
    compareAndLog('category', 'Category');
    compareAndLog('fundSource', 'Fund Source');
    compareAndLog('status', 'Status');
    compareAndLog('acquisitionDate', 'Acquisition Date');
    compareAndLog('acquisitionCost', 'Acquisition Cost');
    compareAndLog('usefulLife', 'Useful Life');
    compareAndLog('salvageValue', 'Salvage Value');
    compareAndLog('condition', 'Condition');
    compareAndLog('remarks', 'Remarks');
    compareAndLog('office', 'Office');

    // Special handling for custodian transfer
    if (updates.custodian && updates.custodian.name && original.custodian.name !== updates.custodian.name) {
        historyEntries.push({ event: 'Transfer', details: `Custodian changed from ${format(original.custodian.name)} to ${format(updates.custodian.name)}.`, user: user_name });
    }

    return historyEntries;
};

const updateAsset = async (req, res) => {
  try {
    const assetId = req.params.id;

    // Since we are using multipart/form-data, nested objects might be stringified.
    const updateData = { ...req.body };

    // Safely parse fields that are expected to be JSON strings from FormData
    const fieldsToParse = ['custodian', 'specifications'];
    for (const field of fieldsToParse) {
        if (updateData[field] && typeof updateData[field] === 'string') {
            try {
                updateData[field] = JSON.parse(updateData[field]);
            } catch (e) {
                // This indicates a malformed request from the client.
                console.error(`Error parsing JSON for field '${field}':`, updateData[field]);
                res.status(400);
                throw new Error(`Invalid data format for ${field}.`);
            }
        }
    }
    const user = req.user; // The user performing the action

    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    // Generate detailed history entries
    const historyEntries = generateMovableAssetUpdateHistory(asset.toObject(), updateData, user);
    if (historyEntries.length > 0) {
        asset.history.push(...historyEntries);
    }

    // --- Handle File Uploads ---
    if (req.files && req.files.length > 0) {
        const attachmentTitles = req.body.attachmentTitles ? JSON.parse(req.body.attachmentTitles) : [];
        const uploadPromises = req.files.map((file, index) =>
            uploadToS3(file, asset._id, attachmentTitles[index] || file.originalname, 'movable-assets')
        );
        const newAttachments = await Promise.all(uploadPromises);
        asset.attachments.push(...newAttachments);
        asset.history.push({ event: 'Updated', details: `${newAttachments.length} new file(s) attached.`, user: req.user.name });
    }


    // Apply updates
    asset.set(updateData);

    const updatedAsset = await asset.save({ runValidators: true });
    res.json(updatedAsset);
  } catch (error) {
    console.error("Error in updateAsset:", error); // Log the full error for better debugging
    res.status(400).json({ message: 'Invalid asset data', error: error.message });
  }
};

const deleteAsset = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (asset) {
      // Perform a "soft delete" by changing the status, which is better for auditing.
      asset.status = 'Disposed';
      asset.history.push({
          event: 'Disposed',
          details: 'Asset marked as disposed.',
          user: req.user.name
      });
      await asset.save();
      res.json({ message: 'Asset marked as disposed' });
    } else { res.status(404).json({ message: 'Asset not found' }); }
  } catch (error) { res.status(500).json({ message: 'Server Error' }); }
};

const deleteAssetAttachment = async (req, res) => {
    const { id, attachmentKey } = req.params;
    const asset = await Asset.findById(id);

    if (!asset) {
        res.status(404);
        throw new Error('Asset not found');
    }

    const attachment = asset.attachments.find(att => att.key === decodeURIComponent(attachmentKey));
    if (!attachment) {
        res.status(404);
        throw new Error('Attachment not found');
    }

    // Delete from S3
    const deleteCommand = new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: attachment.key,
    });
    await s3.send(deleteCommand);

    // Remove from MongoDB
    asset.attachments = asset.attachments.filter(att => att.key !== attachment.key);
    asset.history.push({ event: 'Updated', details: `File removed: "${attachment.originalName}".`, user: req.user.name });
    await asset.save();

    res.status(200).json({ message: 'Attachment deleted successfully' });
};


// NEW: Controller for bulk asset creation
const createBulkAssets = async (req, res) => {
    const { assetData, quantity, startNumber } = req.body;

    if (!assetData || !quantity || !startNumber) {
        return res.status(400).json({ message: 'Missing required fields for bulk creation.' });
    }
    
    const lastHyphenIndex = startNumber.lastIndexOf('-');
    if (lastHyphenIndex === -1) {
        return res.status(400).json({ message: 'Invalid Starting Property Number format. Expected format: PREFIX-NUMBER (e.g., DAET-FUR-001).' });
    }

    const prefix = startNumber.substring(0, lastHyphenIndex + 1);
    const numberStr = startNumber.substring(lastHyphenIndex + 1);
    const startingNumericPart = parseInt(numberStr, 10);

    if (isNaN(startingNumericPart)) {
        return res.status(400).json({ message: 'The numeric part of the Starting Property Number is invalid.' });
    }

    const assetsToCreate = [];
    for (let i = 0; i < quantity; i++) {
        const currentNumber = startingNumericPart + i;
        const newPropertyNumber = `${prefix}${String(currentNumber).padStart(numberStr.length, '0')}`;
        
        assetsToCreate.push({
            ...assetData,
            propertyNumber: newPropertyNumber,
            history: [{
                event: 'Created',
                details: `Asset created with Property Number ${newPropertyNumber}.`,
                user: req.user.name // Use authenticated user
            }]
        });
    }

    try {
        await Asset.insertMany(assetsToCreate);
        res.status(201).json({ message: `${quantity} assets created successfully.` });
    } catch (error) {
        res.status(400).json({ message: 'Error during bulk creation. Check for duplicate Property Numbers.', error: error.message });
    }
};

// NEW: Controller for getting the next available asset number
const getNextPropertyNumber = async (req, res) => {
    const { year, subMajorGroup, glAccount, officeCode } = req.query;

    if (!year || !subMajorGroup || !glAccount || !officeCode) {
        return res.status(400).json({ message: 'Year, category codes, and office code are required.' });
    }

    try {
        const prefix = `${year}-${subMajorGroup}-${glAccount}-${officeCode}-`;
        
        // Find assets with the same prefix, sort them by property number descending, and get the first one.
        const lastAsset = await Asset.findOne({ propertyNumber: { $regex: `^${prefix}` } })
                                     .sort({ propertyNumber: -1 });

        let nextSerial = 1;
        if (lastAsset) {
            const lastNumber = lastAsset.propertyNumber;
            const lastSerialStr = lastNumber.split('-').pop();
            const lastSerial = parseInt(lastSerialStr, 10);
            if (!isNaN(lastSerial)) {
                nextSerial = lastSerial + 1;
            }
        }

        const nextPropertyNumber = `${prefix}${String(nextSerial).padStart(4, '0')}`;
        res.json({ nextPropertyNumber });

    } catch (error) {
        res.status(500).json({ message: 'Server error while generating next property number.', error: error.message });
    }
};

// NEW: Controller for server-side CSV generation
const exportAssetsToCsv = async (req, res) => {
    try {
        const { sort = 'propertyNumber', order = 'asc', search, category, status, office, fundSource, startDate, endDate } = req.query;

        // Build the filter query (same logic as getAssets)
        const query = {};
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { propertyNumber: searchRegex },
                { description: searchRegex },
                { 'custodian.name': searchRegex }
            ];
        }
        if (category) query.category = category;
        if (status) query.status = status;
        if (office) query.office = office;
        if (fundSource) query.fundSource = fundSource;
        if (startDate || endDate) {
            query.acquisitionDate = {};
            if (startDate) query.acquisitionDate.$gte = new Date(startDate);
            if (endDate) {
                query.acquisitionDate.$lte = new Date(endDate);
            }
        }

        const sortOptions = { [sort]: order === 'asc' ? 1 : -1 };

        // Fetch all matching documents without pagination
        const assets = await Asset.find(query).sort(sortOptions).lean();

        // Generate CSV
        const headers = ['Property Number', 'Description', 'Category', 'Custodian', 'Office', 'Status', 'Acquisition Date', 'Acquisition Cost'];
        const csvRows = [headers.join(',')];

        for (const asset of assets) {
            const values = [asset.propertyNumber, `"${(asset.description || '').replace(/"/g, '""')}"`, asset.category, asset.custodian.name, asset.custodian.office, asset.status, asset.acquisitionDate ? new Date(asset.acquisitionDate).toLocaleDateString('en-CA') : 'N/A', asset.acquisitionCost];
            csvRows.push(values.join(','));
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="assets.csv"');
        res.status(200).send(csvRows.join('\n'));
    } catch (error) {
        console.error('Error exporting assets:', error);
        res.status(500).json({ message: 'Failed to export data' });
    }
};

const updatePhysicalCount = async (req, res) => {
    const { updates } = req.body; // Expecting an object with updates array

    if (!Array.isArray(updates)) {
        return res.status(400).json({ message: 'Invalid data format. Expected an array of updates.' });
    }

    try {
        const updatePromises = updates.map(async (update) => {
            const asset = await Asset.findById(update.id);
            if (!asset) {
                console.warn(`Asset with ID ${update.id} not found during physical count. Skipping.`);
                return; // or handle as an error
            }

            const oldCondition = asset.condition;
            const oldRemarks = asset.remarks;

            // Only add to history if condition or remarks have changed.
            if (oldCondition !== update.condition || oldRemarks !== update.remarks) {
                asset.history.push({
                    event: 'Physical Count',
                    details: `Condition changed from "${oldCondition || 'N/A'}" to "${update.condition}". Remarks: ${update.remarks || 'None'}`,
                    from: oldCondition,
                    to: update.condition,
                    user: req.user.name, // Use authenticated user
                });
            }
            asset.condition = update.condition;
            asset.remarks = update.remarks;
            return asset.save();
        });

        await Promise.all(updatePromises);
        res.json({ message: 'Physical count updated successfully.' });
    } catch (error) {
        console.error("Error during physical count update:", error);
        res.status(500).json({ message: 'Server error during physical count update.', error: error.message });
    }
};

const createPtrAndTransferAssets = async (req, res) => {
    const { assetIds, newOffice, newCustodian, transferDate } = req.body;

    if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
        return res.status(400).json({ message: 'Asset IDs must be provided as an array.' });
    }
    if (!newOffice || !newCustodian || !newCustodian.name) {
        return res.status(400).json({ message: 'New office and custodian are required.' });
    }
    if (!transferDate) {
        return res.status(400).json({ message: 'Transfer date is required.' });
    }

    const session = await mongoose.startSession();

    try {
        console.log("Starting bulk transfer transaction...");
        session.startTransaction();

        // Step 1: Fetch assets and validate the transfer request
        const assetsToTransfer = await Asset.find({ '_id': { $in: assetIds } }).session(session);
        if (assetsToTransfer.length !== assetIds.length) {
            throw new Error('One or more assets not found.');
        }
        console.log(`Found ${assetsToTransfer.length} assets to transfer.`);

        // All assets must have the same "from" custodian for a single PTR
        const fromCustodian = assetsToTransfer[0].custodian;
        for (const asset of assetsToTransfer) { // This loop is just for validation
            if (asset.custodian.name !== fromCustodian.name || asset.custodian.office !== fromCustodian.office) {
                throw new Error('All selected assets must have the same current custodian and office to be transferred together.');
            }
        }

        const transferDetails = {
            from: fromCustodian,
            to: { name: newCustodian.name, designation: newCustodian.designation || '', office: newOffice },
            date: new Date(transferDate),
            assets: []
        };

        /**
         * Generates the next sequential PTR number for the current year.
         * Example: PTR-2024-0001
         */
        async function getNextPtrNumber(session) {
            const year = new Date().getFullYear();
            const startOfYear = new Date(year, 0, 1);
        
            const lastPTR = await PTR.findOne({
                createdAt: { $gte: startOfYear }
            }).sort({ createdAt: -1 }).session(session); // Use session for consistency
        
            let sequence = 1;
            if (lastPTR && lastPTR.ptrNumber) {
                const lastSequence = parseInt(lastPTR.ptrNumber.split('-').pop(), 10);
                if (!isNaN(lastSequence)) {
                    sequence = lastSequence + 1;
                }
            }
            return `PTR-${year}-${String(sequence).padStart(4, '0')}`;
        }

        console.log("Updating assets...");
        // Step 2: Update all assets in a single operation
        const historyEntry = {
            event: 'Transfer',
            details: `Transferred from ${fromCustodian.name} (${fromCustodian.office}) to ${newCustodian.name} (${newOffice}).`,
            from: `${fromCustodian.name} (${fromCustodian.office})`,
            to: `${newCustodian.name} (${newOffice})`,
            user: req.user ? req.user.name : 'System'
        };

        const assetUpdateResult = await Asset.updateMany(
            { '_id': { $in: assetIds } },
            {
                $set: { office: newOffice, custodian: transferDetails.to },
                $push: { history: historyEntry }
            }
        ).session(session);

        if (assetUpdateResult.modifiedCount !== assetIds.length) {
            throw new Error(`Failed to update all assets. Expected ${assetIds.length} updates, but got ${assetUpdateResult.modifiedCount}.`);
        }
        console.log(`Successfully updated ${assetUpdateResult.modifiedCount} assets.`);

        // Step 3: Create and save the PTR document
        const ptrNumber = await getNextPtrNumber(session);
        console.log(`Generated new PTR number: ${ptrNumber}`);

        const newPTR = new PTR({
            ptrNumber: ptrNumber,
            from: transferDetails.from,
            to: transferDetails.to,
            assets: [], // Start with an empty array
            date: transferDetails.date,
            user: req.user.name // User who performed the transfer
        });
        // Populate the assets for the PTR details
        assetsToTransfer.forEach(asset => {
            newPTR.assets.push({ propertyNumber: asset.propertyNumber, description: asset.description, acquisitionCost: asset.acquisitionCost, remarks: '' });
        });
        console.log(`Creating PTR with ${newPTR.assets.length} assets.`);
        const savedPTR = await newPTR.save({ session });
        console.log(`Successfully saved PTR with ID: ${savedPTR._id}`);

        // Step 4: If all operations were successful, commit the transaction
        await session.commitTransaction();
        console.log("Transaction committed successfully.");
        
        res.status(200).json({ message: 'Assets transferred successfully.', transferDetails: { ...transferDetails, assets: newPTR.assets, ptrNumber: savedPTR.ptrNumber } });
    } catch (error) {
        console.log("An error occurred. Aborting transaction.");
        await session.abortTransaction();
        console.error('Bulk transfer error:', error);
        res.status(500).json({ message: 'Server error during bulk transfer.', error: error.message });
    } finally {
        console.log("Transaction session ended.");
        session.endSession();
    }
};

const getMyOfficeAssets = async (req, res) => {
    try {
        // The user's office is attached to the request by the 'protect' middleware
        if (!req.user || !req.user.office) {
            return res.status(400).json({ message: 'User office information not found.' });
        }

        const assets = await Asset.find({ 'custodian.office': req.user.office })
            .sort({ propertyNumber: 1 })
            .lean();

        res.json(assets);
    } catch (error) {
        console.error('Error in getMyOfficeAssets:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

/**
 * @desc    Add a repair record to a movable asset
 * @route   POST /api/assets/:id/repairs
 * @access  Private (ASSET_UPDATE)
 */
const addRepairRecord = asyncHandler(async (req, res) => {
    const { date, natureOfRepair, amount } = req.body;

    if (!date || !natureOfRepair || !amount) {
        res.status(400);
        throw new Error('Date, Nature of Repair, and Amount are required.');
    }

    const asset = await Asset.findById(req.params.id);
    if (!asset) {
        res.status(404);
        throw new Error('Asset not found');
    }

    asset.repairHistory.push({ date, natureOfRepair, amount });
    asset.history.push({ event: 'Updated', details: `Repair added: ${natureOfRepair} for ${new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)}.`, user: req.user.name });

    const updatedAsset = await asset.save();
    res.status(201).json(updatedAsset);
});

/**
 * @desc    Delete a repair record from a movable asset
 * @route   DELETE /api/assets/:id/repairs/:repairId
 * @access  Private (ASSET_UPDATE)
 */
const deleteRepairRecord = asyncHandler(async (req, res) => {
    const asset = await Asset.findById(req.params.id);
    if (!asset) {
        res.status(404);
        throw new Error('Asset not found');
    }

    asset.repairHistory.pull({ _id: req.params.repairId });
    asset.history.push({ event: 'Updated', details: `Repair record removed.`, user: req.user.name });

    const updatedAsset = await asset.save();
    res.status(200).json(updatedAsset);
});

/**
 * @desc    Get data for a Movable Property Ledger Card (COA Format)
 * @route   GET /api/assets/:id/ledger-card
 * @access  Private (ASSET_READ)
 */
const generateMovableLedgerCard = asyncHandler(async (req, res) => {
    const asset = await Asset.findById(req.params.id).lean();

    if (!asset) {
        res.status(404);
        throw new Error('Asset not found');
    }

    const acquisitionDate = new Date(asset.acquisitionDate);
    const depreciableCost = asset.acquisitionCost - (asset.salvageValue || 0);
    const annualDepreciation = asset.usefulLife > 0 ? depreciableCost / asset.usefulLife : 0;
    const dailyDepreciation = annualDepreciation / 365.25;

    const combinedLog = [
        ...asset.history.map(h => ({ ...h, logType: 'event' })),
        ...(asset.repairHistory || []).map(r => ({ ...r, logType: 'repair' }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    const ledgerRows = [];
    const currentCost = asset.acquisitionCost;
    const totalImpairment = asset.impairmentLosses || 0;

    combinedLog.forEach(logEntry => {
        const eventDate = new Date(logEntry.date);
        const daysSinceAcquisition = (eventDate - acquisitionDate) / (1000 * 60 * 60 * 24);
        
        let accumulatedDepreciation = 0;
        if (daysSinceAcquisition > 0) {
            accumulatedDepreciation = Math.min(dailyDepreciation * daysSinceAcquisition, depreciableCost);
        }
        const adjustedCost = currentCost - accumulatedDepreciation - totalImpairment;

        const row = {
            date: logEntry.date,
            reference: asset.assignedPAR || asset.assignedICS || 'N/A',
            propertyId: asset.propertyNumber,
            cost: currentCost,
            estimatedUsefulLife: asset.usefulLife,
            accumulatedDepreciation: accumulatedDepreciation,
            impairmentLosses: totalImpairment,
            adjustedCost: adjustedCost,
            repairNature: 'N/A',
            repairAmount: 0,
        };

        if (logEntry.logType === 'event') {
            row.particulars = logEntry.details;
            row.remarks = logEntry.event;
        } else if (logEntry.logType === 'repair') {
            row.particulars = `Repair: ${logEntry.natureOfRepair}`;
            row.remarks = 'Repair/Maintenance';
            row.repairNature = logEntry.natureOfRepair;
            row.repairAmount = logEntry.amount;
        }
        ledgerRows.push(row);
    });

    res.status(200).json({ asset, ledgerRows });
});

module.exports = {
    getAssets, getAssetById, createAsset,
    createBulkAssets, updateAsset, deleteAsset,
    deleteAssetAttachment, getNextPropertyNumber, updatePhysicalCount, exportAssetsToCsv,
    createPtrAndTransferAssets,
    getMyOfficeAssets, addRepairRecord,
    deleteRepairRecord, generateMovableLedgerCard
};
