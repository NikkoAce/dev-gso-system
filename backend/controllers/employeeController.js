const Employee = require('../models/Employee');

const getEmployees = async (req, res) => {
    try {
        const employees = await Employee.find({}).sort({ name: 1 });
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
