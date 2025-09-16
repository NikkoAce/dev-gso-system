// FILE: backend/utils/assetQueryBuilder.js

/**
 * Helper function to build the filter query for assets based on various query parameters.
 * This is centralized to ensure consistent filtering across different parts of the application (e.g., registry, exports).
 * @param {object} queryParams - The query parameters from the request (req.query).
 * @returns {object} A MongoDB query object.
 */
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
    if (office) query['custodian.office'] = office;
    if (fundSource) query.fundSource = fundSource;

    if (condition) {
        query.condition = (condition === 'Not Set') ? { $in: [null, ''] } : condition;
    }

    if (verified) {
        query['physicalCountDetails.verified'] = (verified === 'verified');
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

module.exports = { buildAssetQuery };