const Asset = require('../models/Asset');

const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);
const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-CA') : 'N/A';

const generateRpcppeReport = async (req, res) => {
    try {
        const { fundSource, category, asAtDate } = req.query;

        if (!fundSource || !asAtDate) {
            return res.status(400).json({ message: 'Fund Source and As at Date are required.' });
        }

        const reportDate = new Date(asAtDate);
        reportDate.setHours(23, 59, 59, 999);

        const query = {
            fundSource: fundSource,
            acquisitionDate: { $lte: reportDate }
        };

        if (category) {
            query.category = category;
        }

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
                formatCurrency(a.acquisitionCost),
                location,
                a.condition || '',
                a.remarks || ''
            ];
        });

        res.json({ headers, rows });
    } catch (error) {
        console.error('Error generating RPCPPE report:', error);
        res.status(500).json({ message: 'Server error while generating RPCPPE report.' });
    }
};

const generateDepreciationReport = async (req, res) => {
    try {
        const { fundSource, category, asAtDate } = req.query;

        if (!fundSource || !asAtDate) {
            return res.status(400).json({ message: 'Fund Source and As at Date are required.' });
        }

        const reportDate = new Date(asAtDate);
        reportDate.setHours(23, 59, 59, 999);

        const query = {
            fundSource: fundSource,
            acquisitionDate: { $lte: reportDate }
        };

        if (category) {
            query.category = category;
        }

        const assetsForReport = await Asset.find(query).sort({ propertyNumber: 1 }).lean();

        const headers = ['Property No.', 'Description', 'Acq. Cost', 'Acq. Date', 'Est. Life', 'Accum. Dep., Beg.', 'Dep. for the Period', 'Accum. Dep., End', 'Book Value, End'];
        const rows = assetsForReport.map(asset => {
            const acquisitionDate = new Date(asset.acquisitionDate);
            const startOfYear = new Date(reportDate.getFullYear(), 0, 1);
            
            const depreciableCost = asset.acquisitionCost - (asset.salvageValue || 0);
            const annualDepreciation = asset.usefulLife > 0 ? depreciableCost / asset.usefulLife : 0;

            const ageAtYearStart = (startOfYear - acquisitionDate) / (1000 * 60 * 60 * 24 * 365.25);
            const accumDepreciationBeg = ageAtYearStart > 0 ? Math.min(annualDepreciation * ageAtYearStart, depreciableCost) : 0;
            
            let depreciationForPeriod = 0;
            if (acquisitionDate < reportDate) {
                const startDepreciationDate = acquisitionDate > startOfYear ? acquisitionDate : startOfYear;
                const daysInPeriod = (reportDate - startDepreciationDate) / (1000 * 60 * 60 * 24);
                depreciationForPeriod = (annualDepreciation / 365.25) * daysInPeriod;
            }
            
            const accumDepreciationEnd = Math.min(accumDepreciationBeg + depreciationForPeriod, depreciableCost);
            const bookValueEnd = asset.acquisitionCost - accumDepreciationEnd;

            return [ asset.propertyNumber, asset.description, formatCurrency(asset.acquisitionCost), formatDate(asset.acquisitionDate), `${asset.usefulLife} yrs`, formatCurrency(accumDepreciationBeg), formatCurrency(depreciationForPeriod), formatCurrency(accumDepreciationEnd), formatCurrency(bookValueEnd) ];
        });

        res.json({ headers, rows });
    } catch (error) {
        console.error('Error generating Depreciation report:', error);
        res.status(500).json({ message: 'Server error while generating Depreciation report.' });
    }
};

const testReportRoute = (req, res) => {
    console.log('SUCCESS: /api/reports/test endpoint was hit!');
    res.json({ message: 'Report test route is working!' });
};

module.exports = {
    generateRpcppeReport,
    generateDepreciationReport,
    testReportRoute
};
