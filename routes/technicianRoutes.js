const express = require('express');
const router = express.Router();
const {
    getUnassignedServices,
    createAssignment,
    updateAssignmentStatus,
    getAllTechnicianAssignments
} = require('../controllers/technicianController');
 
router.get('/unassigned-services', getUnassignedServices);
 
router.post('/assignments', createAssignment);

router.get('/assignments', getAllTechnicianAssignments);
 
router.patch('/assignments/:id/status', updateAssignmentStatus);
 
module.exports = router;