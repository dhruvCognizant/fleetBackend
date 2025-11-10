const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const Technician = require('../models/TechnicianRegister');
const Credential = require('../models/Credential');
const RevokedToken = require('../models/RevokedToken');

const opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || 'fallback_secret',
};

module.exports = passport => {
  passport.use(new JwtStrategy(opts, async (payload, done) => {
    try {
      // ✅ Check if token has been revoked
      if (payload?.jti) {
        const revoked = await RevokedToken.findOne({ jti: payload.jti });
        if (revoked) return done(null, false, { message: 'Token revoked' });
      }

      if (payload?.id) {
        const cred = await Credential.findById(payload.id).lean();
        if (cred) {
          if (cred.role === 'admin') {
            return done(null, { id: cred._id.toString(), role: 'admin', email: cred.email });
          }
          const tech = await Technician.findOne({ credential: cred._id }).lean();
          if (tech) {
            return done(null, {
              id: tech._id.toString(),
              role: 'technician',
              email: tech.email,
              firstName: tech.firstName,
              lastName: tech.lastName,
            });
          }
        }
      }

      return done(null, false);
    } catch (err) {
      return done(err, false);
    }
  }));
};
