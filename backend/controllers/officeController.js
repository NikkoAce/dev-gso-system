const Office = require('../models/Office');
const Asset = require('../models/Asset');

const getOffices = async (req, res) => {
    try {
        const { page, limit, sort = 'name', order = 'asc', search = '' } = req.query;

        const pipeline = [];
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            pipeline.push({ $match: { $or: [{ name: searchRegex }, { code: searchRegex }] } });
        }

        pipeline.push(
            // This lookup now correctly counts assets based on the CUSTODIAN's office,
            // which is more intuitive for the user and consistent with the asset registry filter.
            { 
                $lookup: { from: 'assets', localField: 'name', foreignField: 'custodian.office', as: 'assets' } 
            },
            { $addFields: { assetCount: { $size: '$assets' } } },
            { $project: { assets: 0 } },
            { $sort: { [sort]: order === 'asc' ? 1 : -1 } }
        );

        // If no pagination, return all items (for dropdowns)
        if (!page || !limit) {
            const offices = await Office.aggregate(pipeline);
            return res.json(offices);
        }

        // If pagination is requested, continue with pagination logic
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;

        const facetPipeline = [
            ...pipeline,
            {
                $facet: {
                    docs: [{ $skip: skip }, { $limit: limitNum }],
                    totalDocs: [{ $group: { _id: null, count: { $sum: 1 } } }]
                }
            }
        ];

        const results = await Office.aggregate(facetPipeline);
        const docs = results[0].docs;
        const totalDocs = results[0].totalDocs[0] ? results[0].totalDocs[0].count : 0;

        res.json({
            docs,
            totalDocs,
            limit: limitNum,
            totalPages: Math.ceil(totalDocs / limitNum),
            page: pageNum,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

const createOffice = async (req, res) => {
    const { name, code } = req.body;
    if (!name || !code) {
        return res.status(400).json({ message: 'Office name and code are required.' });
    }
    try {
        const office = new Office({ name, code });
        const createdOffice = await office.save();
        res.status(201).json(createdOffice);
    } catch (error) {
        res.status(400).json({ message: 'Invalid office data. Name or code might already exist.', error: error.message });
    }
};

const updateOffice = async (req, res) => {
    try {
        const office = await Office.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (office) {
            res.json(office);
        } else {
            res.status(404).json({ message: 'Office not found' });
        }
    } catch (error) {
        res.status(400).json({ message: 'Invalid office data. Name or code might already exist.', error: error.message });
    }
};

const deleteOffice = async (req, res) => {
    try {
        const office = await Office.findById(req.params.id);

        // Server-side check to prevent deletion if the office is in use.
        const assetCount = await Asset.countDocuments({ office: office.name });
        if (assetCount > 0) {
            return res.status(400).json({ message: `Cannot delete office "${office.name}" because it is assigned to ${assetCount} asset(s).` });
        }

        if (office) {
            await office.deleteOne();
            res.json({ message: 'Office removed' });
        } else {
            res.status(404).json({ message: 'Office not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = { getOffices, createOffice, updateOffice, deleteOffice };
