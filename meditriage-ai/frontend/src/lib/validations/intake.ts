import { z } from 'zod';

export const COMMON_COMORBIDITIES = [
  'Hypertension (High BP)',
  'Type 2 Diabetes Mellitus',
  'Coronary Artery Disease (CAD)',
  'Congestive Heart Failure (CHF)',
  'Chronic Obstructive Pulmonary Disease (COPD) / Asthma',
  'Chronic Kidney Disease (CKD)',
  'Stroke / Prior TIA',
  'Dementia / Cognitive Impairment',
  'Osteoporosis / Prior Falls',
  'Atrial Fibrillation / Arrhythmia',
  'Cancer History',
  'None Known'
];

export const BODY_LOCATIONS = [
  'Chest / Thorax',
  'Head / Neurological',
  'Abdomen / Gastrointestinal',
  'Back / Spine',
  'Arms / Upper Extremities',
  'Legs / Lower Extremities',
  'Throat / Neck',
  'Pelvis / Urinary',
  'Skin / Full Body (Generalized)',
  'Other'
];

const bloodPressureRegex = /^(\d{2,3})\/(\d{2,3})$/;

export const intakeSchema = z
  .object({
    chief_complaint: z
      .string()
      .min(3, 'Chief complaint must be at least 3 characters')
      .max(2000, 'Chief complaint cannot exceed 2000 characters'),
    symptom_duration: z
      .string()
      .min(1, 'Please specify how long this symptom has been present (e.g. 2 hours, 3 days)'),
    severity: z
      .coerce.number()
      .min(1, 'Severity must be at least 1 (Mild)')
      .max(10, 'Severity cannot exceed 10 (Worst Possible)'),
    body_location: z
      .string()
      .min(2, 'Please select or specify the primary body location'),
    age: z
      .coerce.number()
      .int('Age must be a whole number')
      .min(1, 'Age must be at least 1 year')
      .max(125, 'Age cannot exceed 125 years'),
    sex: z.enum(['Female', 'Male', 'Other']),
    pregnancy_status: z.string().optional(),
    comorbidities: z.array(z.string()).optional(),
    current_medications: z.string().optional(),
    allergies: z.string().optional(),
    vitals: z
      .object({
        temperature: z.number().min(85.0, 'Temperature must be at least 85.0°F').max(110.0, 'Temperature cannot exceed 110.0°F').optional(),
        pulse: z.number().int().min(30, 'Pulse must be at least 30 bpm').max(240, 'Pulse cannot exceed 240 bpm').optional(),
        blood_pressure: z.string().optional(),
        spo2: z.number().min(50.0, 'SpO2 must be at least 50%').max(100.0, 'SpO2 cannot exceed 100%').optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    // 1. Male pregnancy validation
    if (data.sex === 'Male' && data.pregnancy_status && data.pregnancy_status.toLowerCase().includes('pregnant')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pregnancy status 'Pregnant' is not compatible with biological sex 'Male'",
        path: ['pregnancy_status'],
      });
    }

    // 2. Blood pressure structure validation
    const bp = data.vitals?.blood_pressure;
    if (bp && bp.trim()) {
      const match = bp.trim().match(bloodPressureRegex);
      if (!match) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Blood pressure must be formatted as systolic/diastolic (e.g., '120/80')",
          path: ['vitals', 'blood_pressure'],
        });
      } else {
        const systolic = parseInt(match[1], 10);
        const diastolic = parseInt(match[2], 10);

        if (systolic < 50 || systolic > 300) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Systolic (${systolic}) must be between 50 and 300 mmHg`,
            path: ['vitals', 'blood_pressure'],
          });
        }
        if (diastolic < 30 || diastolic > 200) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Diastolic (${diastolic}) must be between 30 and 200 mmHg`,
            path: ['vitals', 'blood_pressure'],
          });
        }
        if (systolic <= diastolic) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Systolic (${systolic}) must be strictly higher than diastolic (${diastolic})`,
            path: ['vitals', 'blood_pressure'],
          });
        }
      }
    }
  });

export type IntakeFormValues = z.infer<typeof intakeSchema>;
