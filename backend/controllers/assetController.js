const Asset = require('../models/Asset'); // This will now be the new model with the middleware
const asyncHandler = require('express-async-handler');
const Office = require('../models/Office');
const Counter = require('../models/Counter'); // Import the new Counter model
const { uploadToS3, generatePresignedUrl, s3, DeleteObjectCommand } = require('../lib/s3.js');
const { buildAssetQuery } = require('../utils/assetQueryBuilder');

const getAssets = asyncHandler(async (req, res) => {
    const { page, limit, sort = 'propertyNumber', order = 'asc' } = req.query;

    // 1. Build the filter query using the helper
    const query = buildAssetQuery(req.query);
    const physicalCountMode = req.query.physicalCount === 'true';

    // 2. Build the sort options
    const sortOptions = { [sort]: order === 'asc' ? 1 : -1 };

    // 3. Check if pagination is requested
    if (page && limit) {
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 20;
        const skip = (pageNum - 1) * limitNum;

        const queries = [
            Asset.find(query).sort(sortOptions).skip(skip).limit(limitNum).lean(),
            Asset.countDocuments(query),
            Asset.aggregate([
                { $match: query },
                { $group: { _id: null, totalValue: { $sum: '$acquisitionCost' } } }
            ])
        ];

        // Only run the summary stats aggregation if in physical count mode
        if (physicalCountMode) {
            queries.push(Asset.aggregate([
                { $match: { 'custodian.office': req.query.office } }, // Summary is for the whole office
                { $group: { _id: null, verifiedCount: { $sum: { $cond: [{ $eq: ['$physicalCountDetails.verified', true] }, 1, 0] } }, missingCount: { $sum: { $cond: [{ $eq: ['$status', 'Missing'] }, 1, 0] } }, forRepairCount: { $sum: { $cond: [{ $eq: ['$status', 'For Repair'] }, 1, 0] } } } }
            ]));
        }

        const [assets, totalDocs, summaryResult, summaryStatsResult] = await Promise.all(queries);

        const totalValue = summaryResult[0]?.totalValue || 0;
        const summaryStats = summaryStatsResult?.[0] || { verifiedCount: 0, missingCount: 0, forRepairCount: 0 };

        const response = {
            docs: assets,
            totalDocs,
            totalValue,
            limit: limitNum,
            totalPages: Math.ceil(totalDocs / limitNum),
            page: pageNum,
        };

        if (physicalCountMode) {
            const officeAssetCount = await Asset.countDocuments({ 'custodian.office': req.query.office });
            response.summaryStats = {
                totalOfficeAssets: officeAssetCount,
                verifiedCount: summaryStats.verifiedCount,
                missingCount: summaryStats.missingCount,
                forRepairCount: summaryStats.forRepairCount
            };
        }

        res.json(response);
    } else {
        const [assets, summaryResult] = await Promise.all([
            Asset.find(query).sort(sortOptions).lean(),
            Asset.aggregate([
                { $match: query },
                { $group: { _id: null, totalValue: { $sum: '$acquisitionCost' } } }
            ])
        ]);
        const totalValue = summaryResult[0]?.totalValue || 0;

        res.json({
            docs: assets,
            totalDocs: assets.length,
            totalValue,
            limit: assets.length,
            totalPages: 1,
            page: 1
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

    // Validate that the custodian's office exists
    if (assetData.custodian && assetData.custodian.office) {
        const officeExists = await Office.findOne({ name: assetData.custodian.office });
        if (!officeExists) {
            res.status(400);
            throw new Error(`The custodian office "${assetData.custodian.office}" does not exist. Please select a valid office from the list.`);
        }
    }

    const asset = new Asset(assetData);

    // Attach user to the instance for the pre-save hook to use for history logging
    asset._user = req.user;

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

const updateAsset = asyncHandler(async (req, res) => {
    const assetId = req.params.id;

    // Use the helper to parse all incoming form data
    const updateData = parseFormData(req.body);

    // Validate the custodian's office if it's being updated
    if (updateData.custodian && updateData.custodian.office) {
        const officeExists = await Office.findOne({ name: updateData.custodian.office });
        if (!officeExists) {
            res.status(400);
            throw new Error(`The custodian office "${updateData.custodian.office}" does not exist. Please select a valid office from the list.`);
        }
    }


    const user = req.user; // The user performing the action

    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
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

    // Attach user to the instance for the pre-save hook to use for history logging
    asset._user = user;

    const updatedAsset = await asset.save({ runValidators: true });
    res.json(updatedAsset);
});

const deleteAsset = asyncHandler(async (req, res) => {
    const asset = await Asset.findById(req.params.id);
    if (asset) {
      // Perform a "soft delete" by changing the status, which is better for auditing.
      asset.status = 'Disposed';
      // Attach user for history logging via pre-save hook
      asset._user = req.user;
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

async function getNextSequenceValue(sequenceName, increment = 1) {
    const counter = await Counter.findByIdAndUpdate(
        sequenceName,
        { $inc: { sequence_value: increment } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return counter.sequence_value;
}

// NEW: Controller for bulk asset creation
const createBulkAssets = asyncHandler(async (req, res) => {
    // The request now takes prefix components instead of a startNumber to ensure atomicity.
    const { assetData, quantity, prefixComponents } = req.body;

    if (!assetData || !quantity || !prefixComponents) {
        return res.status(400).json({ message: 'assetData, quantity, and prefixComponents are required for bulk creation.' });
    }

    const { year, subMajorGroup, glAccount, officeCode } = prefixComponents;
    if (!year || !subMajorGroup || !glAccount || !officeCode) {
        return res.status(400).json({ message: 'Incomplete prefix components. Year, subMajorGroup, glAccount, and officeCode are required.' });
    }

    const prefix = `${year}-${subMajorGroup}-${glAccount}-${officeCode}-`;

    // Atomically reserve a block of sequence numbers
    const endSequence = await getNextSequenceValue(prefix, quantity);
    const startSequence = endSequence - quantity + 1;

    if (startSequence < 1) {
        // This is a safeguard, should not happen in normal operation
        throw new Error('Counter returned an invalid sequence. Please try again.');
    }

    const assetsToCreate = [];
    for (let i = 0; i < quantity; i++) {
        const currentNumber = startSequence + i;
        const newPropertyNumber = `${prefix}${String(currentNumber).padStart(4, '0')}`;
        
        // Manually add history here because `insertMany` does not trigger 'save' hooks.
        assetsToCreate.push({
            ...assetData,
            propertyNumber: newPropertyNumber,
            history: [{
                event: 'Created',
                details: `Asset created with Property Number ${newPropertyNumber}.`,
                user: req.user.name
            }]
        });
    }

    // Note: Mongoose 'pre-save' hooks do NOT run on `insertMany`.
    // History is manually added above for each item before insertion.
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

    // Atomically get the next sequence number for this prefix
    const nextSerial = await getNextSequenceValue(prefix);

    const nextPropertyNumber = `${prefix}${String(nextSerial).padStart(4, '0')}`;
    res.json({ nextPropertyNumber });
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
                // Pre-validate all unique office names from the CSV file
                const officeNamesInCsv = [...new Set(results.map(row => row['Custodian Office']).filter(Boolean))];
                if (officeNamesInCsv.length > 0) {
                    const existingOffices = await Office.find({ name: { $in: officeNamesInCsv } }).select('name').lean();
                    const existingOfficeNames = new Set(existingOffices.map(o => o.name));
                    const missingOffices = officeNamesInCsv.filter(name => !existingOfficeNames.has(name));

                    if (missingOffices.length > 0) {
                        throw new Error(`The following office names in your CSV do not exist in the system: ${missingOffices.join(', ')}. Please correct them or add them via Settings > Offices before importing.`);
                    }
                }

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
const exportPhysicalCountResults = asyncHandler((req, res) => {
    const { office } = req.query;

    if (!office) {
        return res.status(400).json({ message: 'Office parameter is required for export.' });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="physical_count_${office.replace(/\s+/g, '_')}.csv"`);

    const query = { 'custodian.office': office };
    const headers = [
        'Property Number', 'Description', 'Custodian', 'Status', 'Condition',
        'Remarks', 'Verification Status', 'Verified By', 'Verified At'
    ];
    res.write(headers.join(',') + '\n');

    const cursor = Asset.find(query).sort({ propertyNumber: 1 }).lean().cursor();

    cursor.on('data', (asset) => {
        try {
            const verificationStatus = asset.physicalCountDetails?.verified ? 'Verified' : 'Unverified';
            const verifiedBy = asset.physicalCountDetails?.verifiedBy || '';
            const verifiedAt = asset.physicalCountDetails?.verifiedAt ? new Date(asset.physicalCountDetails.verifiedAt).toLocaleDateString('en-CA') : '';

            const values = [
                asset.propertyNumber, `"${(asset.description || '').replace(/"/g, '""')}"`, asset.custodian?.name || '',
                asset.status || '', asset.condition || '', `"${(asset.remarks || '').replace(/"/g, '""')}"`,
                verificationStatus, verifiedBy, verifiedAt
            ];
            res.write(values.join(',') + '\n');
        } catch (err) {
            console.error('Error processing a row for CSV export:', err);
        }
    });

    cursor.on('end', () => {
        res.end();
    });

    cursor.on('error', (error) => {
        console.error('Error during physical count export:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Failed to stream data.' });
        } else {
            res.end();
        }
    });
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
