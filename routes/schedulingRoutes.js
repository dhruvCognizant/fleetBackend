const express = require('express');
const router = express.Router();
const { specificScheduleService,getSchechuledServices,getVehicle, getTechnitian, getUnassignedServices} = require('../controllers/schedulingController');

router.get(`/vehicle/:id`,getVehicle);
router.get('/available-technicians', getTechnitian);
router.post('/schedule',specificScheduleService)

router.get('/scheduledServices',getSchechuledServices)

router.get('/unassigned',getUnassignedServices);

module.exports = router;
