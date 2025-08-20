const Employee = require('../models/Employee');
const Asset = require('../models/Asset');

const getEmployees = async (req, res) => {
    try {
        const employees = await Employee.aggregate([
            {
                $lookup: {
                    from: 'assets',
                    localField: 'name',
                    foreignField: 'custodian.name',
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
        res.json(employees);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

const createEmployee = async (req, res) => {
    const { name, designation } = req.body;
    if (!name || !designation) {
        return res.status(400).json({ message: 'Employee name and designation are required.' });
    }
    try {
        const employee = new Employee({ name, designation });
        const createdEmployee = await employee.save();
        res.status(201).json(createdEmployee);
    } catch (error) {
        res.status(400).json({ message: 'Invalid employee data. Name might already exist.', error: error.message });
    }
};

const updateEmployee = async (req, res) => {
    try {
        const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (employee) {
            res.json(employee);
        } else {
            res.status(404).json({ message: 'Employee not found' });
        }
    } catch (error) {
        res.status(400).json({ message: 'Invalid employee data. Name might already exist.', error: error.message });
    }
};

const deleteEmployee = async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        const assetCount = await Asset.countDocuments({ 'custodian.name': employee.name });
        if (assetCount > 0) {
            return res.status(400).json({ message: `Cannot delete employee "${employee.name}" because they are assigned as a custodian to ${assetCount} asset(s).` });
        }
        if (employee) {
            await employee.deleteOne();
            res.json({ message: 'Employee removed' });
        } else {
            res.status(404).json({ message: 'Employee not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = { getEmployees, createEmployee, updateEmployee, deleteEmployee };
