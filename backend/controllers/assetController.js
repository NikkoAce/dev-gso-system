const Asset = require('../models/Asset');
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const PTR = require('../models/PTR'); // Import the new PTR model
const { uploadToS3, generatePresignedUrl, s3, DeleteObjectCommand } = require('../lib/s3.js');
const { getIo } = require('../config/socket');
const csv = require('csv-parser');
const { Readable } = require('stream');

// Replaces the original getAssets to support server-side pagination, sorting, and filtering.

// Helper function to build the filter query for assets
const buildAssetQuery = (queryParams) => {
    const {
        search, category, status, office, assignment, fundSource, startDate, endDate, ids, condition, verified
    } = queryParams;

    const query = {};

    if (ids) {
        query._id = { $in: ids.split(',') };
        return query; // If fetching by IDs, ignore other filters
    }

    if (search) {
        const searchRegex = new RegExp(search, 'i');
        query.$or = [
            { propertyNumber: searchRegex },
            { description: searchRegex },
            { 'custodian.name': searchRegex },
            { 'specifications.key': searchRegex },
            { 'specifications.value': searchRegex }
        ];
    }

    if (category) query.category = category;
    if (status) query.status = status;
    if (office) {
        // This is the fix. The 'office' filter from the UI should search
        // against the custodian's office, not the asset's fund office.
        query['custodian.office'] = office;
    }
    if (fundSource) query.fundSource = fundSource;
    if (condition) {
        if (condition === 'Not Set') {
            // Find documents where 'condition' is null, undefined, or an empty string.
            query.condition = { $in: [null, ''] };
        } else {
            query.condition = condition;
        }
    }

    if (verified) {
        if (verified === 'verified') {
            query['physicalCountDetails.verified'] = true;
        } else if (verified === 'unverified') {
            // This will find documents where verified is false, null, or does not exist.
            query['physicalCountDetails.verified'] = { $ne: true };
        }
    }

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
            endOfDay.setUTCHours(23, 59, 59, 999);
            query.acquisitionDate.$lte = endOfDay;
        }
    }
    return query;
};

const getAssets = asyncHandler(async (req, res) => {
    const { page, limit, sort = 'propertyNumber', order = 'asc' } = req.query;

    // 1. Build the filter query using the helper
    const query = buildAssetQuery(req.query);

    // 2. Build the sort options
    const sortOptions = { [sort]: order === 'asc' ? 1 : -1 };

    // 3. Check if pagination is requested
    if (page && limit) {
        // Pagination logic
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 20;
        const skip = (pageNum - 1) * limitNum;

        // Using Promise.all to run queries concurrently for better performance.
        const [assets, totalDocs, summaryResult, summaryStatsResult] = await Promise.all([
            Asset.find(query).sort(sortOptions).skip(skip).limit(limitNum).lean(),
            Asset.countDocuments(query),
            Asset.aggregate([
                { $match: query },
                { $group: { _id: null, totalValue: { $sum: '$acquisitionCost' } } }
            ]),
            // NEW: Aggregation for summary stats for the physical count dashboard
            Asset.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: null,
                        verifiedCount: { $sum: { $cond: [{ $eq: ['$physicalCountDetails.verified', true] }, 1, 0] } },
                        missingCount: { $sum: { $cond: [{ $eq: ['$status', 'Missing'] }, 1, 0] } },
                        forRepairCount: { $sum: { $cond: [{ $eq: ['$status', 'For Repair'] }, 1, 0] } }
                    }
                }
            ])
        ]);

        const totalValue = summaryResult[0]?.totalValue || 0;
        const summaryStats = summaryStatsResult[0] || { verifiedCount: 0, missingCount: 0, forRepairCount: 0 };

        // Send the structured paginated response
        res.json({
            docs: assets,
            totalDocs,
            totalValue,
            summaryStats: {
                totalOfficeAssets: totalDocs,
                verifiedCount: summaryStats.verifiedCount,
                missingCount: summaryStats.missingCount,
                forRepairCount: summaryStats.forRepairCount
            },
            limit: limitNum,
            totalPages: Math.ceil(totalDocs / limitNum),
            page: pageNum,
        });
    } else {
        // No pagination, return all matching assets but in a consistent format.
        const [assets, summaryResult, summaryStatsResult] = await Promise.all([
            Asset.find(query).sort(sortOptions).lean(),
            Asset.aggregate([
                { $match: query },
                { $group: { _id: null, totalValue: { $sum: '$acquisitionCost' } } }
            ]),
            Asset.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: null,
                        verifiedCount: { $sum: { $cond: [{ $eq: ['$physicalCountDetails.verified', true] }, 1, 0] } },
                        missingCount: { $sum: { $cond: [{ $eq: ['$status', 'Missing'] }, 1, 0] } },
                        forRepairCount: { $sum: { $cond: [{ $eq: ['$status', 'For Repair'] }, 1, 0] } }
                    }
                }
            ])
        ]);
        const totalValue = summaryResult[0]?.totalValue || 0;
        const summaryStats = summaryStatsResult[0] || { verifiedCount: 0, missingCount: 0, forRepairCount: 0 };

        // Return a response object consistent with the paginated one.
        res.json({
            docs: assets, totalDocs: assets.length, totalValue,
            summaryStats: {
                totalOfficeAssets: assets.length,
                verifiedCount: summaryStats.verifiedCount,
                missingCount: summaryStats.missingCount,
                forRepairCount: summaryStats.forRepairCount
            },
            limit: assets.length, totalPages: 1, page: 1
        });
    }
});

const getAssetById = asyncHandler(async (req, res) => {
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
});

// Helper function to parse FormData fields
const parseFormData = (body) => {
    const data = { ...body };

    // Safely parse fields that are expected to be JSON strings
    const fieldsToParseJson = ['custodian', 'specifications', 'attachmentTitles'];
    for (const field of fieldsToParseJson) {
        if (data[field] && typeof data[field] === 'string') {
            try {
                data[field] = JSON.parse(data[field]);
            } catch (e) {
                console.error(`Error parsing JSON for field '${field}':`, data[field]);
                const err = new Error(`Invalid data format for ${field}.`);
                err.statusCode = 400;
                throw err;
            }
        }
    }

    // Manually parse numeric fields that might come in as strings
    const numericFields = ['acquisitionCost', 'usefulLife', 'salvageValue', 'impairmentLosses'];
    for (const field of numericFields) {
        if (data[field] !== undefined && data[field] !== null) {
            const valueAsString = String(data[field]).replace(/,/g, '');
            if (valueAsString === '') {
                data[field] = null;
            } else {
                const parsedValue = parseFloat(valueAsString);
                if (!isNaN(parsedValue)) {
                    data[field] = parsedValue;
                }
            }
        }
    }
    return data;
};

const createAsset = asyncHandler(async (req, res) => {
    // Use the helper to parse all incoming form data
    const assetData = parseFormData(req.body);

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
        const attachmentTitles = assetData.attachmentTitles || [];
        const uploadPromises = req.files.map((file, index) =>
            uploadToS3(file, createdAsset._id, attachmentTitles[index] || file.originalname, 'movable-assets')
        );
        const uploadedAttachments = await Promise.all(uploadPromises);
        createdAsset.attachments.push(...uploadedAttachments);
        createdAsset.history.push({ event: 'Updated', details: `${uploadedAttachments.length} file(s) attached.`, user: req.user.name });
        await createdAsset.save();
    }

    res.status(201).json(createdAsset);
});

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

const updateAsset = asyncHandler(async (req, res) => {
    const assetId = req.params.id;

    // Use the helper to parse all incoming form data
    const updateData = parseFormData(req.body);

    const user = req.user; // The user performing the action

    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    const oldStatus = asset.status; // Capture old status before updates

    // Generate detailed history entries
    const historyEntries = generateMovableAssetUpdateHistory(asset.toObject(), updateData, user);
    if (historyEntries.length > 0) {
        asset.history.push(...historyEntries);
    }

    // --- Handle File Uploads ---
    if (req.files && req.files.length > 0) {
        const attachmentTitles = updateData.attachmentTitles || [];
        const uploadPromises = req.files.map((file, index) =>
            uploadToS3(file, asset._id, attachmentTitles[index] || file.originalname, 'movable-assets')
        );
        const newAttachments = await Promise.all(uploadPromises);
        asset.attachments.push(...newAttachments);
        asset.history.push({ event: 'Updated', details: `${newAttachments.length} new file(s) attached.`, user: req.user.name });
    }


    // Apply updates
    asset.set(updateData);

    // If status is set to Missing, clear any active slip assignments but keep the custodian for accountability.
    if (updateData.status === 'Missing' && oldStatus !== 'Missing') {
        asset.assignedPAR = null;
        asset.assignedICS = null;
        // Add a specific history entry for this action
        asset.history.push({
            event: 'Updated',
            details: 'Active slip assignment (PAR/ICS) cleared due to asset being marked as Missing. Last custodian remains for accountability.',
            user: user.name
        });
    }


    const updatedAsset = await asset.save({ runValidators: true });
    res.json(updatedAsset);
});

const deleteAsset = asyncHandler(async (req, res) => {
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
    } else {
        res.status(404).json({ message: 'Asset not found' });
    }
});

const deleteAssetAttachment = asyncHandler(async (req, res) => {
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
});


// NEW: Controller for bulk asset creation
const createBulkAssets = asyncHandler(async (req, res) => {
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

    await Asset.insertMany(assetsToCreate);
    res.status(201).json({ message: `${quantity} assets created successfully.` });
});

// NEW: Controller for getting the next available asset number
const getNextPropertyNumber = asyncHandler(async (req, res) => {
    const { year, subMajorGroup, glAccount, officeCode } = req.query;

    if (!year || !subMajorGroup || !glAccount || !officeCode) {
        return res.status(400).json({ message: 'Year, category codes, and office code are required.' });
    }

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
});

// NEW: Controller for server-side CSV generation
const exportAssetsToCsv = (req, res) => {
    const { sort = 'propertyNumber', order = 'asc' } = req.query;

    // Build the filter query using the helper
    const query = buildAssetQuery(req.query);
    const sortOptions = { [sort]: order === 'asc' ? 1 : -1 };

    // Set headers for streaming the CSV file
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="assets.csv"');

    // Write headers
    const headers = ['Property Number', 'Description', 'Category', 'Custodian', 'Office', 'Status', 'Acquisition Date', 'Acquisition Cost'];
    res.write(headers.join(',') + '\n');

    // Use a cursor to stream documents one by one instead of loading all into memory
    const cursor = Asset.find(query).sort(sortOptions).lean().cursor();

    cursor.on('data', (asset) => {
        const values = [asset.propertyNumber, `"${(asset.description || '').replace(/"/g, '""')}"`, asset.category, asset.custodian?.name || '', asset.custodian?.office || '', asset.status, asset.acquisitionDate ? new Date(asset.acquisitionDate).toLocaleDateString('en-CA') : 'N/A', asset.acquisitionCost || 0];
        res.write(values.join(',') + '\n');
    });

    cursor.on('end', () => {
        res.end();
    });
};

const updatePhysicalCount = asyncHandler(async (req, res) => {
    const { updates } = req.body; // Expecting an object with updates array

    if (!Array.isArray(updates)) {
        return res.status(400).json({ message: 'Invalid data format. Expected an array of updates.' });
    }

    const updatePromises = updates.map(async (update) => {
        const asset = await Asset.findById(update.id);
        if (!asset) {
            console.warn(`Asset with ID ${update.id} not found during physical count. Skipping.`);
            return; // or handle as an error
        }

        const oldCondition = asset.condition;
        const oldRemarks = asset.remarks;
        const oldStatus = asset.status;

        let details = [];
        if (oldStatus !== update.status) {
            details.push(`Status changed from "${oldStatus || 'N/A'}" to "${update.status}".`);
        }
        if (oldCondition !== update.condition) {
            details.push(`Condition changed from "${oldCondition || 'N/A'}" to "${update.condition}".`);
        }
        if (oldRemarks !== update.remarks && update.remarks) {
            details.push(`Remarks updated: "${update.remarks}".`);
        }

        // Apply the updates to the asset document first
        asset.status = update.status;
        asset.condition = update.condition;
        asset.remarks = update.remarks;

        // If status is set to Missing, clear any active slip assignments but keep the custodian for accountability.
        if (update.status === 'Missing' && oldStatus !== 'Missing') {
            asset.assignedPAR = null;
            asset.assignedICS = null;
            details.push('Slip assignment cleared due to Missing status. Custodian retained for accountability.');
        }

        // Only add to history if there were any changes.
        if (details.length > 0) {
            asset.history.push({
                event: 'Physical Count',
                details: details.join(' '),
                user: req.user.name, // Use authenticated user
            });
        }
        return asset.save();
    });

    const savedAssets = await Promise.all(updatePromises);
    const io = getIo();

    savedAssets.forEach(asset => {
        if (asset && asset.custodian && asset.custodian.office) {
            const room = `office:${asset.custodian.office}`;
            io.to(room).emit('asset-updated', asset.toObject());
        }
    });

    res.json({ message: 'Physical count updated successfully.' });
});

const createPtrAndTransferAssets = asyncHandler(async (req, res) => {
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

        session.startTransaction();

        // Step 1: Fetch assets and validate the transfer request
        const assetsToTransfer = await Asset.find({ '_id': { $in: assetIds } }).session(session);
        if (assetsToTransfer.length !== assetIds.length) {
            throw new Error('One or more assets not found.');
        }

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

        // Step 3: Create and save the PTR document
        const ptrNumber = await getNextPtrNumber(session);
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
        const savedPTR = await newPTR.save({ session });

        // Step 4: If all operations were successful, commit the transaction
        await session.commitTransaction();
        
        res.status(200).json({ message: 'Assets transferred successfully.', transferDetails: { ...transferDetails, assets: newPTR.assets, ptrNumber: savedPTR.ptrNumber } });
});

const getMyOfficeAssets = asyncHandler(async (req, res) => {
    // The user's office is attached to the request by the 'protect' middleware
    if (!req.user || !req.user.office) {
        return res.status(400).json({ message: 'User office information not found.' });
    }

    const assets = await Asset.find({ 'custodian.office': req.user.office })
        .sort({ propertyNumber: 1 })
        .lean();

    res.json(assets);
});

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

/**
 * @desc    Handles the import of assets from a CSV file.
 * @route   POST /api/assets/import
 * @access  Private (Requires 'asset:create' permission)
 */
const importAssetsFromCsv = (req, res) => {
    if (!req.file) {
        res.status(400);
        throw new Error('No CSV file uploaded.');
    }

    const results = [];
    const errors = [];
    let rowCounter = 1; // Start at 1 for header row

    const stream = Readable.from(req.file.buffer);

    stream.pipe(csv())
        .on('data', (data) => {
            rowCounter++;
            // Basic validation for required fields
            if (!data['Property Number'] || !data['Description'] || !data['Category'] || !data['Acquisition Cost']) {
                errors.push({ row: rowCounter, message: 'Missing required fields: Property Number, Description, Category, Acquisition Cost.' });
                return;
            }
            results.push({ ...data, row: rowCounter });
        })
        .on('end', async () => {
            if (errors.length > 0) {
                return res.status(400).json({
                    message: `CSV has ${errors.length} error(s). Please fix them and re-upload.`,
                    errors: errors
                });
            }

            try {
                const assetsToCreate = results.map(row => ({
                    propertyNumber: row['Property Number'],
                    description: row['Description'],
                    category: row['Category'],
                    acquisitionDate: row['Acquisition Date'] ? new Date(row['Acquisition Date']) : new Date(),
                    office: row['Custodian Office'] || 'GSO', // Set the top-level office field
                    acquisitionCost: parseFloat(row['Acquisition Cost']) || 0,
                    fundSource: row['Fund Source'] || 'General Fund',
                    status: row['Status'] || 'In Use',
                    usefulLife: parseInt(row['Useful Life'], 10) || 5,
                    custodian: {
                        name: row['Custodian Name'] || 'Unassigned',
                        office: row['Custodian Office'] || 'GSO',
                        designation: row['Custodian Designation'] || ''
                    },
                    history: [{
                        event: 'Created',
                        details: `Asset imported via CSV upload.`,
                        user: req.user.name
                    }]
                }));

                const propertyNumbers = assetsToCreate.map(a => a.propertyNumber);
                if (new Set(propertyNumbers).size !== propertyNumbers.length) {
                    throw new Error('CSV file contains duplicate Property Numbers.');
                }

                const existingAssets = await Asset.find({ propertyNumber: { $in: propertyNumbers } }).select('propertyNumber').lean();
                if (existingAssets.length > 0) {
                    const existingNumbers = existingAssets.map(a => a.propertyNumber).join(', ');
                    throw new Error(`The following Property Numbers already exist in the database: ${existingNumbers}`);
                }

                const createdAssets = await Asset.insertMany(assetsToCreate);

                res.status(201).json({
                    message: `Successfully imported ${createdAssets.length} assets.`,
                    importedCount: createdAssets.length,
                    errors: []
                });

            } catch (error) {
                res.status(400).json({
                    message: 'An error occurred during the import process.',
                    errors: [{ row: 'N/A', message: error.message }]
                });
            }
        });
};

/**
 * @desc    Provides a downloadable CSV template for asset import.
 * @route   GET /api/assets/import/template
 * @access  Private
 */
const downloadCsvTemplate = (req, res) => {
    const headers = ['Property Number', 'Description', 'Category', 'Acquisition Date', 'Acquisition Cost', 'Fund Source', 'Status', 'Useful Life', 'Custodian Name', 'Custodian Office', 'Custodian Designation'];
    const csvContent = headers.join(',');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="asset_import_template.csv"');
    res.status(200).send(csvContent);
};

/**
 * @desc    Update the verification status of an asset during physical count
 * @route   PUT /api/assets/:id/verify-physical-count
 * @access  Private (Requires 'asset:update' permission)
 */
const verifyAssetForPhysicalCount = asyncHandler(async (req, res) => {
    const { verified } = req.body;
    const asset = await Asset.findById(req.params.id);

    if (!asset) {
        res.status(404);
        throw new Error('Asset not found');
    }

    if (typeof verified !== 'boolean') {
        res.status(400);
        throw new Error('A boolean "verified" status is required.');
    }

    if (verified) {
        asset.physicalCountDetails = {
            verified: true,
            verifiedBy: req.user.name,
            verifiedAt: new Date(),
        };
    } else {
        // If un-verifying, clear the details
        asset.physicalCountDetails = {
            verified: false,
            verifiedBy: null,
            verifiedAt: null,
        };
    }

    const updatedAsset = await asset.save();
    const io = getIo();

    if (updatedAsset.custodian && updatedAsset.custodian.office) {
        const room = `office:${updatedAsset.custodian.office}`;
        io.to(room).emit('asset-verified', updatedAsset.toObject());
    }

    res.status(200).json(updatedAsset.physicalCountDetails);
});

/**
 * @desc    Export physical count results for a specific office to CSV
 * @route   GET /api/assets/physical-count/export
 * @access  Private (Requires 'asset:export' permission)
 */
const exportPhysicalCountResults = asyncHandler(async (req, res, next) => {
    const { office } = req.query;

    if (!office) {
        res.status(400);
        throw new Error('Office parameter is required for export.');
    }

    // Set headers early. If an error occurs after this, we can't change the status code.
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="physical_count_${office.replace(/\s+/g, '_')}.csv"`);

    try {
        const query = { 'custodian.office': office };
        const headers = [
            'Property Number', 'Description', 'Custodian', 'Status', 'Condition',
            'Remarks', 'Verification Status', 'Verified By', 'Verified At'
        ];
        res.write(headers.join(',') + '\n');

        const cursor = Asset.find(query).sort({ propertyNumber: 1 }).lean().cursor();

        for await (const asset of cursor) {
            const verificationStatus = asset.physicalCountDetails?.verified ? 'Verified' : 'Unverified';
            const verifiedBy = asset.physicalCountDetails?.verifiedBy || '';
            const verifiedAt = asset.physicalCountDetails?.verifiedAt ? new Date(asset.physicalCountDetails.verifiedAt).toLocaleDateString('en-CA') : '';

            const values = [
                asset.propertyNumber, `"${(asset.description || '').replace(/"/g, '""')}"`, asset.custodian?.name || '',
                asset.status || '', asset.condition || '', `"${(asset.remarks || '').replace(/"/g, '""')}"`,
                verificationStatus, verifiedBy, verifiedAt
            ];
            res.write(values.join(',') + '\n');
        }

        res.end();
    } catch (error) {
        console.error('Error during physical count export:', error);
        // If headers haven't been sent, pass the error to the Express error handler.
        if (!res.headersSent) {
            return next(error);
        }
        // Otherwise, just end the response, as the client will receive a partial file.
        res.end();
    }
});

module.exports = {
    getAssets, getAssetById, createAsset,
    createBulkAssets, updateAsset, deleteAsset,
    deleteAssetAttachment, getNextPropertyNumber, updatePhysicalCount, exportAssetsToCsv,
    createPtrAndTransferAssets,
    getMyOfficeAssets, addRepairRecord,
    deleteRepairRecord, generateMovableLedgerCard,
    importAssetsFromCsv, downloadCsvTemplate,
    verifyAssetForPhysicalCount,
    exportPhysicalCountResults
};
