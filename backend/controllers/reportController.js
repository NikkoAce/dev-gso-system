const Asset = require('../models/Asset');
const ImmovableAsset = require('../models/immovableAsset');

// Helper function to build the base query for asset reports
const buildAssetQuery = (queryParams) => {
    const { fundSource, category, asAtDate } = queryParams;

    if (!fundSource || !asAtDate) {
        const err = new Error('Fund Source and As at Date are required.');
        err.statusCode = 400;
        throw err;
    }

    const reportDate = new Date(asAtDate);
    reportDate.setHours(23, 59, 59, 999); // Include the entire "as at" day

    const query = {
        fundSource: fundSource,
        acquisitionDate: { $lte: reportDate }
    };

    if (category) {
        query.category = category;
    }

    return { query, reportDate };
};

const generateRpcppeReport = async (req, res) => {
    try {
        const { query } = buildAssetQuery(req.query);

        const assetsForReport = await Asset.find(query).sort({ propertyNumber: 1 }).lean();

        const headers = ['Article', 'Description', 'Property No.', 'Unit Cost', 'Location/Office', 'Condition', 'Remarks'];
        const rows = assetsForReport.map(a => {
            let fullDescription = a.description;
            if (a.specifications && a.specifications.length > 0) {
                const specs = a.specifications.map(s => `${s.key}: ${s.value}`).join(', ');
                fullDescription += ` (${specs})`;
            }

            const location = a.custodian?.office || a.office || 'N/A';

            return [
                a.category,
                fullDescription,
                a.propertyNumber,
                a.acquisitionCost,
                location,
                a.condition || '',
                a.remarks || ''
            ];
        });

        res.json({ headers, rows });
    } catch (error) {
        console.error('Error generating RPCPPE report:', error);
        if (error.statusCode === 400) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server error while generating RPCPPE report.' });
    }
};

const generateDepreciationReport = async (req, res) => {
    try {
        const { query, reportDate } = buildAssetQuery(req.query);

        const assetsForReport = await Asset.find(query).sort({ propertyNumber: 1 }).lean();

        const headers = ['Property No.', 'Description', 'Acq. Cost', 'Acq. Date', 'Est. Life', 'Accum. Dep., Beg.', 'Dep. for the Period', 'Accum. Dep., End', 'Book Value, End'];
        const rows = assetsForReport.map(asset => {
            const acquisitionDate = new Date(asset.acquisitionDate);
            // The beginning of the year for the given report date.
            const startOfYear = new Date(reportDate.getFullYear(), 0, 1);
            
            const depreciableCost = asset.acquisitionCost - (asset.salvageValue || 0);
            // Simple straight-line annual depreciation.
            const annualDepreciation = asset.usefulLife > 0 ? depreciableCost / asset.usefulLife : 0;

            // Calculate age in years from acquisition to the start of the current report year.
            // Using 365.25 days to average out leap years.
            const ageAtYearStart = (startOfYear - acquisitionDate) / (1000 * 60 * 60 * 24 * 365.25);
            // Accumulated depreciation at the start of the year. Cannot be negative or exceed depreciable cost.
            const accumDepreciationBeg = ageAtYearStart > 0 ? Math.min(annualDepreciation * ageAtYearStart, depreciableCost) : 0;
            
            let depreciationForPeriod = 0;
            // Only calculate depreciation for the period if the asset was acquired before the report date.
            if (acquisitionDate < reportDate) {
                // Depreciation for the current period starts from the beginning of the year, or the acquisition date if it's within the year.
                const startDepreciationDate = acquisitionDate > startOfYear ? acquisitionDate : startOfYear;
                const daysInPeriod = (reportDate - startDepreciationDate) / (1000 * 60 * 60 * 24);
                // Pro-rata depreciation for the period based on the number of days.
                depreciationForPeriod = (annualDepreciation / 365.25) * daysInPeriod;
            }
            
            // Total accumulated depreciation at the end of the period.
            const accumDepreciationEnd = Math.min(accumDepreciationBeg + depreciationForPeriod, depreciableCost);
            // Final book value at the end of the period.
            const bookValueEnd = asset.acquisitionCost - accumDepreciationEnd;

            return [
                asset.propertyNumber,
                asset.description,
                asset.acquisitionCost,
                asset.acquisitionDate,
                asset.usefulLife,
                accumDepreciationBeg,
                depreciationForPeriod,
                accumDepreciationEnd,
                bookValueEnd
            ];
        });

        res.json({ headers, rows });
    } catch (error) {
        console.error('Error generating Depreciation report:', error);
        if (error.statusCode === 400) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server error while generating Depreciation report.' });
    }
};

const generateImmovableReport = async (req, res) => {
    try {
        const { type, status } = req.query;

        const query = {};
        if (type) query.type = type;
        if (status) query.status = status;

        const assets = await ImmovableAsset.find(query).sort({ propertyIndexNumber: 1 }).lean();

        const headers = ['PIN', 'Name', 'Type', 'Location', 'Date Acquired', 'Assessed Value', 'Condition', 'Status'];
        const rows = assets.map(a => {
            return [
                a.propertyIndexNumber,
                a.name,
                a.type,
                a.location,
                a.dateAcquired ? new Date(a.dateAcquired).toLocaleDateString('en-CA') : 'N/A',
                a.assessedValue,
                a.condition || '',
                a.status || ''
            ];
        });

        res.json({ headers, rows });
    } catch (error) {
        console.error('Error generating Immovable Property report:', error);
        res.status(500).json({ message: 'Server error while generating Immovable Property report.' });
    }
};

const testReportRoute = (req, res) => {
    console.log('SUCCESS: /api/reports/test endpoint was hit!');
    res.json({ message: 'Report test route is working!' });
};

module.exports = {
    generateRpcppeReport,
    generateDepreciationReport,
    generateImmovableReport,
    testReportRoute
};
