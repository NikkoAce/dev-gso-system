const Asset = require('../models/Asset');
const Employee = require('../models/Employee');
const Requisition = require('../models/Requisition');
const mongoose = require('mongoose');
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
        query.acquisitionDate.$lte = new Date(endDate);
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

      // Using Promise.all to run queries concurrently for better performance
      const [assets, totalDocs] = await Promise.all([
        Asset.find(query).sort(sortOptions).skip(skip).limit(limitNum).lean(),
        Asset.countDocuments(query)
      ]);

      // Send the structured paginated response
      res.json({
        docs: assets,
        totalDocs,
        limit: limitNum,
        totalPages: Math.ceil(totalDocs / limitNum),
        page: pageNum,
      });
    } else {
      // No pagination, return all matching assets (for dashboard, etc.)
      const assets = await Asset.find(query).sort(sortOptions).lean();
      res.json(assets); // The dashboard expects an array
    }
  } catch (error) {
    console.error('Error in getAssets:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

const getAssetById = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (asset) { res.json(asset); } 
    else { res.status(404).json({ message: 'Asset not found' }); }
  } catch (error) { res.status(500).json({ message: 'Server Error' }); }
};

const createAsset = async (req, res) => {
  try {
    // Add the initial history entry
    const assetData = {
        ...req.body,
        history: [{
            event: 'Created',
            details: `Asset created with Property Number ${req.body.propertyNumber}.`,
            user: req.user.name // Use authenticated user
        }]
    };
    const asset = new Asset(assetData);
    const createdAsset = await asset.save();
    res.status(201).json(createdAsset);
  } catch (error) {
    if (error.code === 11000 && error.keyPattern && error.keyPattern.propertyNumber) {
        return res.status(400).json({ message: `Property Number '${error.keyValue.propertyNumber}' already exists.` });
    }
    res.status(400).json({ message: 'Invalid asset data', error: error.message });
  }
};

const updateAsset = async (req, res) => {
  try {
    const assetId = req.params.id;
    const updateData = req.body;
    const user = req.user; // The user performing the action

    // Find the asset *before* the update to compare fields
    const originalAsset = await Asset.findById(assetId).lean();
    if (!originalAsset) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    const historyEntries = [];

    // Check for Office Transfer
    if (updateData.office && originalAsset.office !== updateData.office) {
        historyEntries.push({
            event: 'Transfer',
            details: `Office changed from ${originalAsset.office} to ${updateData.office}.`,
            from: originalAsset.office,
            to: updateData.office,
            user: user ? user.name : 'System'
        });
    }

    // Check for Custodian Transfer
    if (updateData.custodian && originalAsset.custodian.name !== updateData.custodian.name) {
        historyEntries.push({
            event: 'Transfer',
            details: `Custodian changed from ${originalAsset.custodian.name} to ${updateData.custodian.name}.`,
            from: originalAsset.custodian.name,
            to: updateData.custodian.name,
            user: user ? user.name : 'System' // Use the name of the user who made the change
        });
    }

    if (historyEntries.length > 0) {
        updateData.$push = { history: { $each: historyEntries } };
    }

    const asset = await Asset.findByIdAndUpdate(assetId, updateData, { new: true, runValidators: true });
    if (asset) { res.json(asset); } 
    else { res.status(404).json({ message: 'Asset not found' }); }
  } catch (error) { res.status(400).json({ message: 'Invalid asset data', error: error.message }); }
};

const deleteAsset = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (asset) {
      await asset.deleteOne();
      res.json({ message: 'Asset removed' });
    } else { res.status(404).json({ message: 'Asset not found' }); }
  } catch (error) { res.status(500).json({ message: 'Server Error' }); }
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

// NEW: Controller for saving scan results
const updateScanResults = async (req, res) => {
    const { foundAssetNumbers } = req.body;

    if (!Array.isArray(foundAssetNumbers)) {
        return res.status(400).json({ message: 'Invalid data format. Expected an array of property numbers.' });
    }

    try {
        const today = new Date().toLocaleDateString('en-CA');
        const remarks = `Verified during physical count on ${today}`;
        const newCondition = 'Serviceable';

        const assets = await Asset.find({ propertyNumber: { $in: foundAssetNumbers } });

        const updatePromises = assets.map(asset => {
            const oldCondition = asset.condition;

            if (oldCondition !== newCondition) {
                asset.history.push({
                    event: 'Physical Count (Scanner)',
                    details: `Condition changed from "${oldCondition || 'N/A'}" to "${newCondition}". Remarks: ${remarks}`,
                    from: oldCondition,
                    to: newCondition,
                    user: req.user.name // Use authenticated user
                });
            }
            asset.condition = newCondition;
            asset.remarks = remarks;
            return asset.save();
        });

        await Promise.all(updatePromises);
        res.json({ message: 'Scan results saved successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error while saving scan results.', error: error.message });
    }
};

const bulkTransferAssets = async (req, res) => {
    const { assetIds, newOffice, newCustodian } = req.body;

    if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
        return res.status(400).json({ message: 'Asset IDs must be provided as an array.' });
    }
    if (!newOffice || !newCustodian || !newCustodian.name) {
        return res.status(400).json({ message: 'New office and custodian are required.' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const assetsToTransfer = await Asset.find({ '_id': { $in: assetIds } }).session(session);
        if (assetsToTransfer.length !== assetIds.length) {
            throw new Error('One or more assets not found.');
        }

        // All assets must have the same "from" custodian for a single PTR
        const fromCustodian = assetsToTransfer[0].custodian;
        for (const asset of assetsToTransfer) {
            if (asset.custodian.name !== fromCustodian.name || asset.custodian.office !== fromCustodian.office) {
                throw new Error('All selected assets must have the same current custodian and office to be transferred together.');
            }
        }

        const transferDetails = {
            from: fromCustodian,
            to: { name: newCustodian.name, designation: newCustodian.designation || '', office: newOffice },
            date: new Date(),
            assets: []
        };

        for (const asset of assetsToTransfer) {
            const oldCustodianName = asset.custodian.name;
            const oldOffice = asset.office;

            asset.office = newOffice;
            asset.custodian = { name: newCustodian.name, designation: newCustodian.designation || '', office: newOffice };
            asset.history.push({ event: 'Transfer', details: `Transferred from ${oldCustodianName} (${oldOffice}) to ${newCustodian.name} (${newOffice}).`, from: `${oldCustodianName} (${oldOffice})`, to: `${newCustodian.name} (${newOffice})`, user: req.user ? req.user.name : 'System' });
            await asset.save({ session });

            transferDetails.assets.push({ propertyNumber: asset.propertyNumber, description: asset.description, acquisitionCost: asset.acquisitionCost, remarks: '' });
        }

        await session.commitTransaction();
        session.endSession();
        res.status(200).json({ message: 'Assets transferred successfully.', transferDetails });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Bulk transfer error:', error);
        res.status(500).json({ message: 'Server error during bulk transfer.', error: error.message });
    }
};

const getDashboardStats = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // 1. Define Date Filters
        const dateFilter = {};
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate) dateFilter.$lte = new Date(endDate);

        const hasDateFilter = Object.keys(dateFilter).length > 0;

        // --- Trend Calculation ---
        let previousPeriodFilter = {};
        if (hasDateFilter) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const diff = end.getTime() - start.getTime();
            const prevEnd = new Date(start.getTime() - 1);
            const prevStart = new Date(prevEnd.getTime() - diff);
            previousPeriodFilter = { $gte: prevStart, $lte: prevEnd };
        }

        const calculateTrend = (current, previous) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            if (current === previous) return 0;
            return parseFloat((((current - previous) / previous) * 100).toFixed(2));
        };

        // 2. Fetch Data Concurrently
        const [
            Asset.aggregate([
                {
                    $group: {
                        _id: null,
                        totalValue: { $sum: '$acquisitionCost' },
                        totalCount: { $sum: 1 }
                    }
                }
            ]),
            Asset.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } },
                { $project: { _id: 0, k: '$_id', v: '$count' } }
            ]),
            Asset.aggregate([
                { $group: { _id: '$category', count: { $sum: 1 } } },
                { $project: { _id: 0, k: '$_id', v: '$count' } }
            ])
        ]);

        const response = {
            totalValue: totalStats[0]?.totalValue || 0,
            totalCount: totalStats[0]?.totalCount || 0,
            statusCounts: statusCounts.reduce((acc, item) => {
                if (item.k) acc[item.k] = item.v;
                return acc;
            }, {}),
            categoryCounts: categoryCounts.reduce((acc, item) => {
                if (item.k) acc[item.k] = item.v;
                return acc;
            }, {})
        };

        res.json(response);

    } catch (error) {
        console.error('Error in getDashboardStats:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
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

module.exports = {
    getAssets, getAssetById, createAsset,
    createBulkAssets, updateAsset, deleteAsset,
    getNextPropertyNumber, updatePhysicalCount,
    updateScanResults, bulkTransferAssets,
    exportAssetsToCsv, getDashboardStats,
    getMyOfficeAssets
};
