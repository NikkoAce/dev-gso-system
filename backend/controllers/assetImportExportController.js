const asyncHandler = require('express-async-handler');
const csv = require('csv-parser');
const { Readable } = require('stream');
const Asset = require('../models/Asset');
const Office = require('../models/Office');
const { buildAssetQuery } = require('../utils/assetQueryBuilder');

/**
 * @desc    Export filtered assets to a CSV file
 * @route   GET /api/assets/batch/export
 * @access  Private (Requires 'asset:export' permission)
 */
const exportAssetsToCsv = (req, res) => {
    const { sort = 'propertyNumber', order = 'asc' } = req.query;
    const query = buildAssetQuery(req.query);
    const sortOptions = { [sort]: order === 'asc' ? 1 : -1 };

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="assets.csv"');

    const headers = ['Property Number', 'Description', 'Category', 'Custodian', 'Office', 'Status', 'Acquisition Date', 'Acquisition Cost'];
    res.write(headers.join(',') + '\n');

    const cursor = Asset.find(query).sort(sortOptions).lean().cursor();

    cursor.on('data', (asset) => {
        const values = [
            asset.propertyNumber,
            `"${(asset.description || '').replace(/"/g, '""')}"`,
            asset.category,
            asset.custodian?.name || '',
            asset.custodian?.office || '',
            asset.status,
            asset.acquisitionDate ? new Date(asset.acquisitionDate).toLocaleDateString('en-CA') : 'N/A',
            asset.acquisitionCost || 0
        ];
        res.write(values.join(',') + '\n');
    });

    cursor.on('end', () => res.end());
    cursor.on('error', (error) => { console.error('Error streaming CSV export:', error); res.end(); });
};

/**
 * @desc    Handles the import of assets from a CSV file.
 * @route   POST /api/assets/batch/import
 * @access  Private (Requires 'asset:create' permission)
 */
const importAssetsFromCsv = (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No CSV file uploaded.' });
    }

    const results = [];
    const errors = [];
    let rowCounter = 1;

    const stream = Readable.from(req.file.buffer);

    stream.pipe(csv())
        .on('data', (data) => {
            rowCounter++;
            if (!data['Property Number'] || !data['Description'] || !data['Category'] || !data['Acquisition Cost']) {
                errors.push({ row: rowCounter, message: 'Missing required fields: Property Number, Description, Category, Acquisition Cost.' });
                return;
            }
            results.push({ ...data, row: rowCounter });
        })
        .on('end', async () => {
            if (errors.length > 0) {
                return res.status(400).json({ message: `CSV has ${errors.length} error(s).`, errors });
            }

            try {
                const officeNamesInCsv = [...new Set(results.map(row => row['Custodian Office']).filter(Boolean))];
                if (officeNamesInCsv.length > 0) {
                    const existingOffices = await Office.find({ name: { $in: officeNamesInCsv } }).select('name').lean();
                    const existingOfficeNames = new Set(existingOffices.map(o => o.name));
                    const missingOffices = officeNamesInCsv.filter(name => !existingOfficeNames.has(name));
                    if (missingOffices.length > 0) {
                        throw new Error(`The following office names in your CSV do not exist: ${missingOffices.join(', ')}.`);
                    }
                }

                const assetsToCreate = results.map(row => ({
                    propertyNumber: row['Property Number'],
                    description: row['Description'],
                    category: row['Category'],
                    acquisitionDate: row['Acquisition Date'] ? new Date(row['Acquisition Date']) : new Date(),
                    office: row['Custodian Office'] || 'GSO',
                    acquisitionCost: parseFloat(row['Acquisition Cost']) || 0,
                    fundSource: row['Fund Source'] || 'General Fund',
                    status: row['Status'] || 'In Use',
                    usefulLife: parseInt(row['Useful Life'], 10) || 5,
                    custodian: {
                        name: row['Custodian Name'] || 'Unassigned',
                        office: row['Custodian Office'] || 'GSO',
                        designation: row['Custodian Designation'] || ''
                    },
                    _user: req.user, // For history hook
                }));

                const propertyNumbers = assetsToCreate.map(a => a.propertyNumber);
                if (new Set(propertyNumbers).size !== propertyNumbers.length) {
                    throw new Error('CSV file contains duplicate Property Numbers.');
                }

                const existingAssets = await Asset.find({ propertyNumber: { $in: propertyNumbers } }).select('propertyNumber').lean();
                if (existingAssets.length > 0) {
                    throw new Error(`The following Property Numbers already exist: ${existingAssets.map(a => a.propertyNumber).join(', ')}`);
                }

                // Using .create() instead of insertMany to trigger the 'save' hook for history
                const createdAssets = await Asset.create(assetsToCreate);

                res.status(201).json({ message: `Successfully imported ${createdAssets.length} assets.`, importedCount: createdAssets.length, errors: [] });

            } catch (error) {
                res.status(400).json({ message: 'An error occurred during the import process.', errors: [{ row: 'N/A', message: error.message }] });
            }
        });
};

/**
 * @desc    Provides a downloadable CSV template for asset import.
 * @route   GET /api/assets/batch/import/template
 * @access  Private
 */
const downloadCsvTemplate = (req, res) => {
    const headers = ['Property Number', 'Description', 'Category', 'Acquisition Date', 'Acquisition Cost', 'Fund Source', 'Status', 'Useful Life', 'Custodian Name', 'Custodian Office', 'Custodian Designation'];
    const csvContent = headers.join(',');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="asset_import_template.csv"');
    res.status(200).send(csvContent);
};

module.exports = { exportAssetsToCsv, importAssetsFromCsv, downloadCsvTemplate };
