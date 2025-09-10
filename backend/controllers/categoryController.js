const Category = require('../models/Category');
const Asset = require('../models/Asset');

const getCategories = async (req, res) => {
    try {
           const { page = 1, limit = 15, sort = 'name', order = 'asc', search = '' } = req.query;

        const pipeline = [];
        if (search) {
            pipeline.push({ $match: { name: { $regex: search, $options: 'i' } } });
        }

        pipeline.push(
            { $lookup: { from: 'assets', localField: 'name', foreignField: 'category', as: 'assets' } },
            { $addFields: { assetCount: { $size: '$assets' } } },
            { $project: { assets: 0 } },
            { $sort: { [sort]: order === 'asc' ? 1 : -1 } }
        );

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

        const results = await Category.aggregate(facetPipeline);
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

const createCategory = async (req, res) => {
    const { name, subMajorGroup, glAccount, accountGroup, majorAccountGroup } = req.body;
    if (!name || !subMajorGroup || !glAccount) {
        return res.status(400).json({ message: 'Category Name, Sub-Major Group, and GL Account are required.' });
    }
    try {
        const category = new Category({ name, subMajorGroup, glAccount, accountGroup, majorAccountGroup });
        const createdCategory = await category.save();
        res.status(201).json(createdCategory);
    } catch (error) {
        res.status(400).json({ message: 'Invalid category data. Name might already exist.', error: error.message });
    }
};

const updateCategory = async (req, res) => {
    try {
        const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (category) {
            res.json(category);
        } else {
            res.status(404).json({ message: 'Category not found' });
        }
    } catch (error) {
        res.status(400).json({ message: 'Invalid category data. Name might already exist.', error: error.message });
    }
};

const deleteCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }

        const assetCount = await Asset.countDocuments({ category: category.name });
        if (assetCount > 0) {
            return res.status(400).json({ message: `Cannot delete category "${category.name}" because it is assigned to ${assetCount} asset(s).` });
        }

        if (category) {
            await category.deleteOne();
            res.json({ message: 'Category removed' });
        } else {
            res.status(404).json({ message: 'Category not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = { getCategories, createCategory, updateCategory, deleteCategory };
