const PAR = require('../models/PAR');
const ICS = require('../models/ICS');

const getSlips = async (req, res) => {
    try {
        const pars = await PAR.find({}).populate('assets').lean();
        const ics = await ICS.find({}).populate('assets').lean();

        const formattedPars = pars.map(p => ({ ...p, slipType: 'PAR', number: p.parNumber }));
        const formattedIcs = ics.map(i => ({ ...i, slipType: 'ICS', number: i.icsNumber }));

        const allSlips = [...formattedPars, ...formattedIcs];

        allSlips.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json(allSlips);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = { getSlips };