const Category = require('../models/Category');
const Asset = require('../models/Asset');

const getCategories = async (req, res) => {
    try {
        const categories = await Category.aggregate([
            {
                $lookup: {
                    from: 'assets',
                    localField: 'name',
                    foreignField: 'category',
                    as: 'assets'
                }
            },
            {
                $addFields: {
                    assetCount: { $size: '$assets' }
                }
            },
            {
                $project: { assets: 0 }
            },
            { $sort: { name: 1 } }
        ]);
        res.json(categories);
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
