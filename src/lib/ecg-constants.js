export const ECG_CONSTANTS = {
    PAPER_SPEEDS: { '12.5': 12.5, '25': 25, '50': 50 },
    GAINS: { '5': 5, '10': 10, '20': 20 },

    NORMAL: {
        PR_INTERVAL:    { min: 120, max: 200 },
        QRS_DURATION:   { min: 60,  max: 110 },
        QT_INTERVAL:    { min: 350, max: 440 },
        QTC_MAX_MALE:   450,
        QTC_MAX_FEMALE: 460,
        P_DURATION:     { min: 60,  max: 120 },
        P_AMPLITUDE:    { min: 0.05, max: 0.25 },
        QRS_AMPLITUDE:  { min: 0.5, max: 2.5 },
        T_AMPLITUDE:    { min: 0.1, max: 0.5 },
        ST_DEVIATION:   { min: -0.05, max: 0.1 },
        HEART_RATE:     { min: 60, max: 100 },
    },

    LEADS: {
        'I':   { angle: 0,   type: 'limb',     desc: 'I导联 (0°)' },
        'II':  { angle: 60,  type: 'limb',     desc: 'II导联 (60°)' },
        'III': { angle: 120, type: 'limb',     desc: 'III导联 (120°)' },
        'aVR': { angle: -150,type: 'limb',     desc: 'aVR导联 (-150°)' },
        'aVL': { angle: -30, type: 'limb',     desc: 'aVL导联 (-30°)' },
        'aVF': { angle: 90,  type: 'limb',     desc: 'aVF导联 (90°)' },
        'V1':  { angle: null,type: 'precordial',desc: 'V1导联 (胸导)' },
        'V2':  { angle: null,type: 'precordial',desc: 'V2导联 (胸导)' },
        'V3':  { angle: null,type: 'precordial',desc: 'V3导联 (胸导)' },
        'V4':  { angle: null,type: 'precordial',desc: 'V4导联 (胸导)' },
        'V5':  { angle: null,type: 'precordial',desc: 'V5导联 (胸导)' },
        'V6':  { angle: null,type: 'precordial',desc: 'V6导联 (胸导)' },
    },

    ST_ELEVATION_CRITERIA: {
        male_under_40:       { V2V3: 2.5, other: 1.0 },
        male_over_40:        { V2V3: 2.0, other: 1.0 },
        female:              { V2V3: 1.5, other: 1.0 },
    },

    BAZETT_K: 0.39,
    FRIDERICIA_K: 0.415,
};

export const GRID = {
    SMALL_SQUARE_MM: 1,
    LARGE_SQUARE_MM: 5,
    SMALL_SQUARE_TIME: 0.04,
    LARGE_SQUARE_TIME: 0.20,
    SMALL_SQUARE_MV: 0.1,
    LARGE_SQUARE_MV: 0.5,
};
