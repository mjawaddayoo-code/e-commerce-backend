const { z } = require('zod');
const Settings = require('../models/Settings');
const asyncHandler = require('../utils/asyncHandler');

const str = z.string().max(300).optional();
exports.settingsSchema = z.object({
  businessName: z.string().min(2).max(80), logo: z.object({ url: z.string().url(), publicId: z.string().optional() }).optional(),
  phone: str, whatsapp: str, email: z.string().email().optional().or(z.literal('')), address: str,
  openingTime: z.string().regex(/^\d{2}:\d{2}$/), closingTime: z.string().regex(/^\d{2}:\d{2}$/),
  deliveryFee: z.number().min(0), freeDeliveryThreshold: z.number().min(0), estimatedDeliveryMinutes: z.number().int().min(5).max(240),
  deliveryAreas: z.array(z.object({ name: z.string().min(2), fee: z.number().min(0), active: z.boolean().optional() })).max(50),
  taxPercent: z.number().min(0).max(30), currency: z.string().max(5),
  social: z.object({ facebook: str, instagram: str, tiktok: str }).optional(), googleMapsEmbedUrl: str,
}).partial();

exports.getPublic = asyncHandler(async (req, res) => res.json({ success: true, settings: await Settings.get() }));

exports.update = asyncHandler(async (req, res) => {
  const s = await Settings.get();
  Object.assign(s, req.body);
  await s.save();
  res.json({ success: true, settings: s });
});
