const asyncHandler = require('express-async-handler');
const ImmovableAsset = require('../models/immovableAsset');
const { uploadToS3, generatePresignedUrl, s3, DeleteObjectCommand } = require('../lib/s3.js');
const mongoose = require('mongoose');

// Helper function to parse stringified JSON from FormData
const parseJSON = (string) => {
    try {
        return JSON.parse(string);
    } catch (e) {
        return undefined;
    }
};

/**
 * @desc    Get immovable assets with pagination, filtering, and sorting
 * @route   GET /api/immovable-assets
 * @access  Private
 */
const getImmovableAssets = asyncHandler(async (req, res) => {
    const { page, limit, sort = 'propertyIndexNumber', order = 'asc', search, type, status, condition, startDate, endDate } = req.query;

    const query = {};
    if (search) {
        const searchRegex = new RegExp(search, 'i');
        query.$or = [{ name: searchRegex }, { propertyIndexNumber: searchRegex }, { location: searchRegex }];
    }
    if (type) query.type = type;
    if (status) query.status = status;
    if (condition) query.condition = condition;
    if (startDate || endDate) {
        query.dateAcquired = {};
        if (startDate) query.dateAcquired.$gte = new Date(startDate);
        if (endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);
            query.dateAcquired.$lt = endOfDay;
        }
    }

    const sortOptions = { [sort]: order === 'asc' ? 1 : -1 };

    // The base pipeline for calculating values and matching
    const basePipeline = [
        { $match: query },
        { $addFields: { totalImprovementsCost: { $ifNull: [{ $sum: '$capitalImprovements.cost' }, 0] } } },
        { $addFields: { totalBookValue: { $add: ['$assessedValue', '$totalImprovementsCost'] } } }
    ];

    if (page && limit) {
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;

        const facetPipeline = [
            ...basePipeline,
            {
                $facet: {
                    paginatedDocs: [
                        { $sort: sortOptions },
                        { $skip: skip },
                        { $limit: limitNum },
                        { $lookup: { from: 'immovableassets', localField: 'parentAsset', foreignField: '_id', as: 'parentAsset' } },
                        { $unwind: { path: '$parentAsset', preserveNullAndEmptyArrays: true } },
                        {
                            $project: {
                                name: 1, propertyIndexNumber: 1, type: 1, location: 1, assessedValue: 1, totalBookValue: 1, status: 1,
                                'parentAsset._id': 1, 'parentAsset.name': 1
                            }
                        }
                    ],
                    summary: [
                        {
                            $group: {
                                _id: null,
                                totalDocs: { $sum: 1 },
                                totalAssessedValue: { $sum: '$assessedValue' },
                                totalBookValue: { $sum: '$totalBookValue' }
                            }
                        }
                    ]
                }
            }
        ];

        const results = await ImmovableAsset.aggregate(facetPipeline);
        const assets = results[0].paginatedDocs;
        const summary = results[0].summary[0] || { totalDocs: 0, totalAssessedValue: 0, totalBookValue: 0 };

        res.json({
            docs: assets,
            totalDocs: summary.totalDocs,
            totalValue: summary.totalAssessedValue,
            totalBookValue: summary.totalBookValue,
            limit: limitNum,
            totalPages: Math.ceil(summary.totalDocs / limitNum),
            page: pageNum,
        });
    } else {
        // If no pagination params, return all matching assets (for map view, etc.)
        const assets = await ImmovableAsset.aggregate([
            ...basePipeline,
            { $sort: sortOptions },
            { $lookup: { from: 'immovableassets', localField: 'parentAsset', foreignField: '_id', as: 'parentAsset' } },
            { $unwind: { path: '$parentAsset', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    // Project all fields needed for map and CSV export
                    name: 1, propertyIndexNumber: 1, type: 1, location: 1, assessedValue: 1, totalBookValue: 1, status: 1, dateAcquired: 1, condition: 1,
                    geometry: 1, latitude: 1, longitude: 1, remarks: 1, fundSource: 1, accountCode: 1, acquisitionMethod: 1, impairmentLosses: 1,
                    landDetails: 1, buildingAndStructureDetails: 1,
                    'parentAsset._id': 1, 'parentAsset.name': 1
                }
            }
        ]);
        // Make the response consistent with the paginated one
        res.json({
            docs: assets,
            totalDocs: assets.length,
            limit: assets.length,
            totalPages: 1,
            page: 1,
        });
    }
});

/**
 * @desc    Create a new immovable asset
 * @route   POST /api/immovable-assets
 * @access  Private
 */
const createImmovableAsset = asyncHandler(async (req, res) => {
    const {
        name, propertyIndexNumber, type, location, dateAcquired, assessedValue,
        fundSource, accountCode, status, acquisitionMethod, condition, remarks,
        impairmentLosses, parentAsset,
        // --- NEW: GIS Coordinates ---
        latitude, longitude,
        geometry, // Stringified JSON fields
        landDetails, buildingAndStructureDetails, roadNetworkDetails, otherInfrastructureDetails,
        components, attachmentTitles
    } = req.body;

    // --- NEW: Parent-Child Validation ---
    if (parentAsset) {
        const parent = await ImmovableAsset.findById(parentAsset);
        if (!parent) {
            res.status(400);
            throw new Error('Selected parent asset does not exist.');
        }
        if (type === 'Land') {
            res.status(400);
            throw new Error('A "Land" asset cannot be assigned as a child to another asset.');
        }
        if (parent.type !== 'Land') {
            res.status(400);
            throw new Error(`An asset of type "${type}" can only be assigned to a parent asset of type "Land".`);
        }
    }

    const assetData = {
        name, propertyIndexNumber, type, location, dateAcquired, assessedValue,
        fundSource, accountCode, status, acquisitionMethod, condition, remarks,
        impairmentLosses, parentAsset: parentAsset || null,
        // --- NEW: GIS Coordinates ---
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        geometry: parseJSON(geometry),
        // Parse JSON fields
        landDetails: parseJSON(landDetails),
        buildingAndStructureDetails: parseJSON(buildingAndStructureDetails),
        roadNetworkDetails: parseJSON(roadNetworkDetails),
        otherInfrastructureDetails: parseJSON(otherInfrastructureDetails),
        components: parseJSON(components),
        history: [{ event: 'Created', user: req.user.name, details: 'Asset record created.' }]
    };

    const asset = await ImmovableAsset.create(assetData);

    if (asset) {
        // Handle File Uploads
        if (req.files && req.files.length > 0) {
            const attachmentTitlesArray = parseJSON(attachmentTitles) || [];
            const uploadPromises = req.files.map((file, index) =>
                uploadToS3(file, asset._id, attachmentTitlesArray[index] || file.originalname, 'immovable-assets')
            );
            const uploadedAttachments = await Promise.all(uploadPromises);
            asset.attachments.push(...uploadedAttachments);
            asset.history.push({ event: 'Updated', details: `${uploadedAttachments.length} file(s) attached.`, user: req.user.name });
            await asset.save();
        }

        res.status(201).json(asset);
    } else {
        res.status(400);
        throw new Error('Invalid asset data');
    }
});

/**
 * @desc    Get a single immovable asset by ID
 * @route   GET /api/immovable-assets/:id
 * @access  Private
 */
const getImmovableAssetById = asyncHandler(async (req, res) => {
    const asset = await ImmovableAsset.findById(req.params.id).populate('parentAsset', 'name propertyIndexNumber').lean();

    if (!asset) {
        res.status(404);
        throw new Error('Asset not found');
    }

    // --- NEW: Find child assets ---
    const childAssets = await ImmovableAsset.find({ parentAsset: asset._id })
        .select('name propertyIndexNumber type status')
        .sort({ name: 1 })
        .lean();

    // Generate pre-signed URLs for attachments
    if (asset.attachments && asset.attachments.length > 0) {
        asset.attachments = await Promise.all(
            asset.attachments.map(async (att) => ({
                ...att,
                url: await generatePresignedUrl(att.key)
            }))
        );
    }

    // Add child assets to the response object
    asset.childAssets = childAssets;
    res.json(asset);
});

/**
 * @desc    Update an immovable asset
 * @route   PUT /api/immovable-assets/:id
 * @access  Private
 */
const updateImmovableAsset = asyncHandler(async (req, res) => {
    const asset = await ImmovableAsset.findById(req.params.id);

    if (!asset) {
        res.status(404);
        throw new Error('Asset not found');
    }

    // Parse all fields from FormData
    const updateData = {};
    for (const key in req.body) {
        updateData[key] = parseJSON(req.body[key]) ?? req.body[key];
    }

    // Handle GIS coordinates separately
    if (req.body.latitude) updateData.latitude = parseFloat(req.body.latitude);
    if (req.body.longitude) updateData.longitude = parseFloat(req.body.longitude);
    
    // Handle parent asset link (set to null if empty string is passed)
    if ('parentAsset' in req.body) updateData.parentAsset = req.body.parentAsset || null;

    // --- NEW: Parent-Child Validation on Update ---
    if (updateData.parentAsset) {
        const parent = await ImmovableAsset.findById(updateData.parentAsset);
        if (!parent) {
            res.status(400);
            throw new Error('Selected parent asset does not exist.');
        }
        // Use the asset's current type for validation. If type is also being updated, use the new type.
        const assetType = updateData.type || asset.type;
        if (assetType === 'Land') {
            res.status(400);
            throw new Error('A "Land" asset cannot be assigned as a child to another asset.');
        }
        if (parent.type !== 'Land') {
            res.status(400);
            throw new Error(`An asset of type "${assetType}" can only be assigned to a parent asset of type "Land".`);
        }
    }

    // Apply updates
    Object.assign(asset, updateData);

    // Handle new attachments
    if (req.files && req.files.length > 0) {
        const attachmentTitlesArray = parseJSON(req.body.attachmentTitles) || [];
        const uploadPromises = req.files.map((file, index) =>
            uploadToS3(file, asset._id, attachmentTitlesArray[index] || file.originalname, 'immovable-assets')
        );
        const newAttachments = await Promise.all(uploadPromises);
        asset.attachments.push(...newAttachments);
        asset.history.push({ event: 'Updated', details: `${newAttachments.length} new file(s) attached.`, user: req.user.name });
    }

    // Check if parentAsset was part of the update and if it changed
    const originalParentId = asset.parentAsset ? asset.parentAsset.toString() : null;
    const newParentId = updateData.parentAsset ? updateData.parentAsset.toString() : null;

    if (originalParentId !== newParentId) {
        asset.history.push({ event: 'Updated', user: req.user.name, details: `Parent asset link changed.` });
    } else {
        asset.history.push({ event: 'Updated', user: req.user.name, details: 'Asset details updated.' });
    }

    const updatedAsset = await asset.save();
    res.json(updatedAsset);
});

/**
 * @desc    Delete an immovable asset
 * @route   DELETE /api/immovable-assets/:id
 * @access  Private
 */
const deleteImmovableAsset = asyncHandler(async (req, res) => {
    const asset = await ImmovableAsset.findById(req.params.id);
    if (!asset) {
        res.status(404);
        throw new Error('Asset not found');
    }
    // Soft delete by changing status
    asset.status = 'Disposed';
    asset.history.push({ event: 'Disposed', user: req.user.name, details: 'Asset marked as disposed.' });
    await asset.save();
    res.json({ message: 'Asset marked as disposed' });
});

/**
 * @desc    Delete an attachment from an immovable asset
 * @route   DELETE /api/immovable-assets/:id/attachments/:attachmentKey
 * @access  Private
 */
const deleteImmovableAssetAttachment = asyncHandler(async (req, res) => {
    const { id, attachmentKey } = req.params;
    const asset = await ImmovableAsset.findById(id);
    if (!asset) {
        res.status(404);
        throw new Error('Asset not found');
    }
    const decodedKey = decodeURIComponent(attachmentKey);
    const attachment = asset.attachments.find(att => att.key === decodedKey);
    if (!attachment) {
        res.status(404);
        throw new Error('Attachment not found');
    }
    // Delete from S3
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: decodedKey }));
    // Remove from MongoDB
    asset.attachments = asset.attachments.filter(att => att.key !== decodedKey);
    asset.history.push({ event: 'Updated', details: `File removed: "${attachment.originalName}".`, user: req.user.name });
    await asset.save();
    res.status(200).json({ message: 'Attachment deleted successfully' });
});

/**
 * @desc    Generate a Real Property Ledger Card (depreciation)
 * @route   GET /api/immovable-assets/:id/ledger-card
 * @access  Private
 */
const generateImmovableLedgerCard = asyncHandler(async (req, res) => {
    const asset = await ImmovableAsset.findById(req.params.id).lean();
    if (!asset) {
        res.status(404); throw new Error('Asset not found');
    }
    if (!['Building', 'Other Structures'].includes(asset.type)) {
        res.status(400); throw new Error('Ledger cards are only applicable for Buildings and Other Structures.');
    }

    const details = asset.buildingAndStructureDetails;
    const acquisitionDate = new Date(asset.dateAcquired);
    const depreciableCost = asset.assessedValue - (details.salvageValue || 0);
    const annualDepreciation = details.estimatedUsefulLife > 0 ? depreciableCost / details.estimatedUsefulLife : 0;

    const ledgerRows = [];
    let currentBookValue = asset.assessedValue;

    for (let i = 0; i <= details.estimatedUsefulLife; i++) {
        const yearEndDate = new Date(acquisitionDate.getFullYear() + i, 11, 31);
        const accumulatedDepreciation = Math.min(annualDepreciation * (i + 1), depreciableCost);
        currentBookValue = asset.assessedValue - accumulatedDepreciation;

        ledgerRows.push({
            date: yearEndDate,
            reference: 'N/A',
            particulars: `Depreciation for Year ${i + 1}`,
            propertyId: asset.propertyIndexNumber,
            cost: asset.assessedValue,
            estimatedUsefulLife: details.estimatedUsefulLife,
            accumulatedDepreciation: accumulatedDepreciation,
            impairmentLosses: asset.impairmentLosses || 0,
            adjustedCost: currentBookValue,
            repairNature: '', repairAmount: '', remarks: ''
        });
    }
    res.json({ asset, ledgerRows });
});

/**
 * @desc    Add a repair record to an immovable asset
 * @route   POST /api/immovable-assets/:id/repairs
 * @access  Private
 */
const addRepairRecord = asyncHandler(async (req, res) => {
    const asset = await ImmovableAsset.findById(req.params.id);
    if (!asset) { res.status(404); throw new Error('Asset not found'); }
    asset.repairHistory.push(req.body);
    asset.history.push({ event: 'Updated', details: `Repair added: ${req.body.natureOfRepair}`, user: req.user.name });
    await asset.save();
    res.status(201).json(asset);
});

/**
 * @desc    Delete a repair record from an immovable asset
 * @route   DELETE /api/immovable-assets/:id/repairs/:repairId
 * @access  Private
 */
const deleteRepairRecord = asyncHandler(async (req, res) => {
    const asset = await ImmovableAsset.findById(req.params.id);
    if (!asset) { res.status(404); throw new Error('Asset not found'); }
    asset.repairHistory.pull({ _id: req.params.repairId });
    asset.history.push({ event: 'Updated', details: `Repair record removed.`, user: req.user.name });
    await asset.save();
    res.status(200).json(asset);
});

module.exports = { createImmovableAsset, updateImmovableAsset, getImmovableAssets, getImmovableAssetById, deleteImmovableAsset, deleteImmovableAssetAttachment, generateImmovableAssetReport, generateImmovableLedgerCard, addRepairRecord, deleteRepairRecord };
