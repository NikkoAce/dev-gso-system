const Office = require('../models/Office');
const Asset = require('../models/Asset');

const getOffices = async (req, res) => {
    try {
        // Use aggregation to count how many assets are associated with each office.
        const offices = await Office.aggregate([
            {
                $lookup: {
                    from: 'assets', // The collection name for Assets
                    localField: 'name',
                    foreignField: 'office',
                    as: 'assets'
                }
            },
            {
                $addFields: {
                    assetCount: { $size: '$assets' }
                }
            },
            {
                $project: { assets: 0 } // Exclude the assets array from the final output
            },
            { $sort: { name: 1 } }
        ]);
        res.json(offices);
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
