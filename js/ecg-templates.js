// ECG Templates - Predefined parameter sets for common physiological/pathological conditions
// Based on clinical guidelines: AHA/ACC/ESC, Braunwald's Heart Disease, Goldberger's Clinical Electrocardiography

const ECG_TEMPLATES = {

    // ==================== NORMAL VARIANTS ====================
    'normal_sinus': {
        name: '正常窦性心律',
        category: '正常',
        description: '正常窦性心律，P波在I、II、aVF导联直立，aVR导联倒置。PR间期120-200ms，QRS时限<110ms，ST段等电位，T波与QRS主波方向一致。',
        params: {
            heartRate: 72,
            rhythm: 'regular',
            rhythmType: 'sinus',
            prInterval: 160,
            qrsDuration: 90,
            qtInterval: 390,
            qtcInterval: 400,
            pAmplitude: 0.15,
            pDuration: 90,
            pAxis: 50,
            qrsAmplitude: 1.5,
            qrsAxis: 30,
            tAmplitude: 0.3,
            tAxis: 40,
            stElevation: 0,
            stDepression: 0,
            stSlope: 'flat',
            twaveShape: 'asymmetric',
            uWavePresent: false,
        }
    },

    'sinus_bradycardia': {
        name: '窦性心动过缓',
        category: '心律失常',
        description: '窦性心律，心率<60bpm。P波形态正常，PR间期正常，每个P波后跟随QRS波。常见于运动员、睡眠状态或迷走神经张力增高。',
        params: {
            heartRate: 48,
            rhythm: 'regular',
            rhythmType: 'sinus',
            prInterval: 170,
            qrsDuration: 90,
            qtInterval: 440,
            qtcInterval: 395,
            pAmplitude: 0.15,
            pDuration: 95,
            qrsAmplitude: 1.4,
            tAmplitude: 0.35,
            stElevation: 0,
            stDepression: 0,
            stSlope: 'flat',
            twaveShape: 'asymmetric',
            qrsAxis: 30, pAxis: 50, tAxis: 40,
        }
    },

    'sinus_tachycardia': {
        name: '窦性心动过速',
        category: '心律失常',
        description: '窦性心律，心率>100bpm。P波形态可略高尖，PR间期可略缩短。需排除发热、贫血、甲亢、心衰等病因。',
        params: {
            heartRate: 115,
            rhythm: 'regular',
            rhythmType: 'sinus',
            prInterval: 140,
            qrsDuration: 85,
            qtInterval: 320,
            qtcInterval: 410,
            pAmplitude: 0.18,
            pDuration: 85,
            qrsAmplitude: 1.5,
            tAmplitude: 0.25,
            stElevation: 0,
            stDepression: -0.03,
            stSlope: 'upsloping',
            twaveShape: 'symmetric_peaked',
            reciprocalChanges: { leads: ['II','III','aVF'], stDepression: 0.15 },
            qrsAxis: 25, pAxis: 50, tAxis: 40,
        }
    },

    'acute_inferior_mi': {
        name: '急性下壁心肌梗死',
        category: '心肌缺血/梗死',
        description: '急性下壁STEMI：II、III、aVF导联ST段抬高≥1mm。III导联抬高幅度常>II导联。对应前壁/高侧壁导联ST段压低。需加做右胸导联排除右室梗死。',
        params: {
            heartRate: 70,
            rhythm: 'regular',
            rhythmType: 'sinus',
            prInterval: 165,
            qrsDuration: 90,
            qtInterval: 400,
            qtcInterval: 410,
            pAmplitude: 0.15,
            pDuration: 90,
            qrsAmplitude: 1.4,
            qWave: { depth: 0.25, duration: 0.04, leads: ['II','III','aVF'] },
            stElevation: 0.25, // mV in inferior leads
            stShape: 'straight',
            tAmplitude: 0.35,
            twaveShape: 'symmetric_peaked',
            reciprocalChanges: { leads: ['I','aVL'], stDepression: 0.1 },
            qrsAxis: 30, pAxis: 50, tAxis: 40,
        }
    },

    'acute_lateral_mi': {
        name: '急性侧壁心肌梗死',
        category: '心肌缺血/梗死',
        description: '急性侧壁STEMI：I、aVL、V5、V6导联ST段抬高≥1mm。可能由回旋支闭塞引起。需注意高侧壁（I、aVL）改变。',
        params: {
            heartRate: 78,
            rhythm: 'regular',
            rhythmType: 'sinus',
            prInterval: 160,
            qrsDuration: 92,
            qtInterval: 390,
            qtcInterval: 415,
            pAmplitude: 0.15,
            pDuration: 90,
            qrsAmplitude: 1.5,
            qWave: { depth: 0.2, duration: 0.04, leads: ['I','aVL','V5','V6'] },
            stElevation: 0.2,
            stShape: 'straight',
            tAmplitude: 0.3,
            twaveShape: 'symmetric_peaked',
            reciprocalChanges: { leads: ['III','aVF'], stDepression: 0.08 },
            qrsAxis: -30, pAxis: 50, tAxis: 40,
        }
    },

    'acute_posterior_mi': {
        name: '急性后壁心肌梗死',
        category: '心肌缺血/梗死',
        description: '急性后壁STEMI：V1-V3导联出现对应性改变——ST段压低、R波增高增宽、T波直立高大。V7-V9导联可见ST段抬高。',
        params: {
            heartRate: 75,
            rhythm: 'regular',
            rhythmType: 'sinus',
            prInterval: 165,
            qrsDuration: 90,
            qtInterval: 395,
            qtcInterval: 415,
            pAmplitude: 0.15,
            pDuration: 90,
            qrsAmplitude: 1.6,
            rWaveProminent: { leads: ['V1','V2'], duration: 0.05, amplitude: 0.8 },
            stDepression: -0.15,
            stDepressionLeads: ['V1','V2','V3'],
            tAmplitude: 0.4,
            tUprightProminent: true,
            twaveShape: 'tall_upright',
            qrsAxis: 30, pAxis: 50, tAxis: 40,
        }
    },

    'subendocardial_ischemia': {
        name: '心内膜下缺血',
        category: '心肌缺血/梗死',
        description: '心内膜下缺血：多导联ST段水平型或下斜型压低，伴T波低平或倒置。运动负荷试验时常见。需除外NSTEMI。',
        params: {
            heartRate: 80,
            rhythm: 'regular',
            rhythmType: 'sinus',
            prInterval: 160,
            qrsDuration: 90,
            qtInterval: 390,
            qtcInterval: 420,
            pAmplitude: 0.15,
            pDuration: 90,
            qrsAmplitude: 1.4,
            stElevation: 0,
            stDepression: -0.2,
            stSlope: 'horizontal',
            stShape: 'horizontal_depression',
            tAmplitude: 0.15,
            tLowAmplitude: true,
            twaveShape: 'flat_inverted',
            qrsAxis: 25, pAxis: 50, tAxis: 45,
        }
    },

    'wellens_syndrome': {
        name: 'Wellens综合征',
        category: '心肌缺血/梗死',
        description: 'Wellens综合征：V2-V3导联（可扩展至V1-V6）T波深倒置（A型）或正负双向（B型），无明显ST段抬高，提示左前降支近端严重狭窄，为STEMI前兆。',
        params: {
            heartRate: 75,
            rhythm: 'regular',
            rhythmType: 'sinus',
            prInterval: 165,
            qrsDuration: 88,
            qtInterval: 400,
            qtcInterval: 415,
            pAmplitude: 0.15,
            pDuration: 90,
            qrsAmplitude: 1.4,
            stElevation: 0,
            stDepression: 0,
            tAmplitude: 0.5,
            tInvertedDeep: true,
            tBiphasic: false,
            leadsInvolved: ['V2','V3','V4'],
            twaveShape: 'deep_symmetric_inverted',
            qrsAxis: 30, pAxis: 50, tAxis: 40,
        }
    },

    // ==================== CHAMBER HYPERTROPHY ====================
    'left_ventricular_hypertrophy': {
        name: '左心室肥厚',
        category: '心室肥厚',
        description: 'LVH电压标准：SV1+RV5/RV6>35mm（Sokolow-Lyon标准）或aVL R波>11mm。伴左室高电压、ST-T继发性改变（劳损型）。电轴左偏常见。',
        params: {
            heartRate: 68,
            rhythm: 'regular',
            rhythmType: 'sinus',
            prInterval: 170,
            qrsDuration: 105,
            qtInterval: 420,
            qtcInterval: 425,
            pAmplitude: 0.2,
            pDuration: 100,
            leftAtrialEnlargement: true,
            qrsAmplitude: 3.0,
            highVoltage: true,
            strainPattern: true,
            tAmplitude: 0.5,
            tInverted: true,
            tAsymmetricInverted: true,
            stDepression: -0.1,
            stSlope: 'downsloping',
            axis: -15,
            twaveShape: 'lv_strain',
        }
    },

    'right_ventricular_hypertrophy': {
        name: '右心室肥厚',
        category: '心室肥厚',
        description: 'RVH：电轴右偏>110°，V1导联R/S>1，V1 R波>7mm，V5-V6导联S波加深。ST-T改变在右胸导联。常见于慢性肺心病、先天性心脏病。',
        params: {
            heartRate: 78,
            rhythm: 'regular',
            rhythmType: 'sinus',
            prInterval: 165,
            qrsDuration: 95,
            qtInterval: 390,
            qtcInterval: 410,
            pAmplitude: 0.25,
            pDuration: 100,
            pPulmonale: true,
            qrsAmplitude: 1.8,
            v1DominantR: true,
            v1RAmplitude: 0.8,
            tAmplitude: 0.3,
            tInverted: true,
            tInvertedV1V3: true,
            stDepression: -0.05,
            stSlope: 'downsloping',
            axis: 120,
            twaveShape: 'rv_strain',
        }
    },

    // ==================== ELECTROLYTE & METABOLIC ====================
    'hyperkalemia': {
        name: '高钾血症',
        category: '电解质紊乱',
        description: '高钾血症心电演变：T波高尖对称（血钾5.5-6.5mmol/L）→P波低平增宽、PR延长→P波消失（血钾>7.5）→QRS增宽呈正弦波形（血钾>8.0），可致室颤/心脏停搏。',
        params: {
            heartRate: 75,
            rhythm: 'regular',
            rhythmType: 'sinus',
            prInterval: 190,
            qrsDuration: 100,
            qtInterval: 380,
            qtcInterval: 400,
            pAmplitude: 0.08,
            pDuration: 100,
            pLowAmplitude: true,
            qrsAmplitude: 1.4,
            tAmplitude: 0.6,
            tPeaked: true,
            tNarrowBase: true,
            tSymmetry: true,
            twaveShape: 'peaked_symmetric_tented',
            qrsAxis: 30, pAxis: 50, tAxis: 30,
        }
    },

    'hypokalemia': {
        name: '低钾血症',
        category: '电解质紊乱',
        description: '低钾血症：T波低平或倒置、U波明显增高（>1mm或>T波高度）、ST段压低、QT间期延长（实际为QU间期延长）。严重时可出现室性心律失常。',
        params: {
            heartRate: 72,
            rhythm: 'regular',
            rhythmType: 'sinus',
            prInterval: 165,
            qrsDuration: 90,
            qtInterval: 410,
            qtcInterval: 420,
            pAmplitude: 0.15,
            pDuration: 90,
            qrsAmplitude: 1.4,
            tAmplitude: 0.1,
            tFlattened: true,
            uWaveAmplitude: 0.2,
            uWavePresent: true,
            uWaveProminent: true,
            stDepression: -0.08,
            stSlope: 'downsloping',
            twaveShape: 'flat_u_wave',
            qrsAxis: 25, pAxis: 50, tAxis: 40,
        }
    },

    'hypercalcemia': {
        name: '高钙血症',
        category: '电解质紊乱',
        description: '高钙血症：QT间期缩短（ST段缩短），T波可正常或增宽。严重高钙时QRS可增宽、PR延长。特征性"短QT"。',
        params: {
            heartRate: 75,
            rhythm: 'regular',
            rhythmType: 'sinus',
            prInterval: 160,
            qrsDuration: 88,
            qtInterval: 340,
            qtcInterval: 355,
            pAmplitude: 0.15,
            pDuration: 90,
            qrsAmplitude: 1.4,
            tAmplitude: 0.3,
            stShort: true,
            twaveShape: 'asymmetric',
            qrsAxis: 30, pAxis: 50, tAxis: 40,
        }
    },

    'hypocalcemia': {
        name: '低钙血症',
        category: '电解质紊乱',
        description: '低钙血症：QT间期延长（ST段延长），T波形态正常或低平。QTc显著延长，主要由ST段延长引起。需警惕尖端扭转型室速风险。',
        params: {
            heartRate: 72,
            rhythm: 'regular',
            rhythmType: 'sinus',
            prInterval: 170,
            qrsDuration: 90,
            qtInterval: 460,
            qtcInterval: 480,
            pAmplitude: 0.15,
            pDuration: 90,
            qrsAmplitude: 1.4,
            tAmplitude: 0.25,
            stSegmentProlonged: true,
            twaveShape: 'asymmetric',
            qrsAxis: 30, pAxis: 50, tAxis: 40,
        }
    },

    // ==================== CHANNELOPATHIES ====================
    'long_qt_syndrome': {
        name: '长QT综合征',
        category: '离子通道病',
        description: '长QT综合征：QTc男性>450ms、女性>460ms。LQT1为宽大T波，LQT2为双峰T波，LQT3为晚发高尖T波。有尖端扭转型室速风险。',
        params: {
            heartRate: 65,
            rhythm: 'regular',
            rhythmType: 'sinus',
            prInterval: 165,
            qrsDuration: 90,
            qtInterval: 500,
            qtcInterval: 510,
            pAmplitude: 0.15,
            pDuration: 90,
            qrsAmplitude: 1.4,
            tAmplitude: 0.35,
            tNotched: true,
            tBroadBased: true,
            twaveShape: 'broad_biphasic_notched',
            qrsAxis: 30, pAxis: 50, tAxis: 40,
        }
    },

    'brugada_syndrome': {
        name: 'Brugada综合征',
        category: '离子通道病',
        description: 'Brugada综合征：V1-V3导联ST段呈穹窿型（1型）或马鞍型（2型）抬高≥2mm，伴T波倒置。不完全性右束支传导阻滞样改变。SCN5A基因突变相关。',
        params: {
            heartRate: 70,
            rhythm: 'regular',
            rhythmType: 'sinus',
            prInterval: 170,
            qrsDuration: 100,
            qtInterval: 390,
            qtcInterval: 405,
            pAmplitude: 0.15,
            pDuration: 90,
            qrsAmplitude: 1.4,
            brugadaPattern: 'type1',
            stElevation: 0.3,
            stShape: 'coved',
            jPointElevation: 0.25,
            tInverted: true,
            twaveShape: 'brugada_inverted',
            qrsAxis: 30, pAxis: 50, tAxis: 40,
        }
    },

    // ==================== PERICARDIAL DISEASE ====================
    'acute_pericarditis': {
        name: '急性心包炎',
        category: '心包疾病',
        description: '急性心包炎：广泛导联ST段凹面向上抬高（除aVR和V1外），PR段压低，无对应性ST段压低（与STEMI鉴别要点）。后期T波可倒置。',
        params: {
            heartRate: 95,
            rhythm: 'regular',
            rhythmType: 'sinus',
            prInterval: 155,
            qrsDuration: 88,
            qtInterval: 370,
            qtcInterval: 420,
            pAmplitude: 0.15,
            pDuration: 90,
            qrsAmplitude: 1.3,
            stElevation: 0.15,
            stShape: 'concave_upward',
            stDiffuse: true,
            prDepression: 0.05,
            tAmplitude: 0.25,
            twaveShape: 'asymmetric',
            qrsAxis: 25, pAxis: 50, tAxis: 40,
        }
    },

    // ==================== PACEMAKER ====================
    'ventricular_paced': {
        name: '心室起搏心律',
        category: '起搏器',
        description: '心室起搏心电图：起搏信号（钉样信号）在前，其后跟随宽大畸形QRS波（类似LBBB形态因为右室心尖部起搏）。可见房室顺序起搏或单纯心室起搏。',
        params: {
            heartRate: 70,
            rhythm: 'regular',
            rhythmType: 'paced',
            prInterval: null,
            qrsDuration: 160,
            qtInterval: 430,
            qtcInterval: 440,
            pPresent: false,
            paceSpike: { amplitude: 0.3, duration: 2 }, // ms
            qrsAmplitude: 1.8,
            qrsMorphology: 'paced_lbbb',
            tAmplitude: 0.35,
            tDirection: 'opposite',
            twaveShape: 'opposite_qrs',
            qrsAxis: -60, tAxis: 120,
        }
    },

    // ==================== PULMONARY ====================
    'pulmonary_embolism': {
        name: '肺栓塞心电图表现',
        category: '肺血管疾病',
        description: '急性肺栓塞：SIQIIITIII（I导联S波加深、III导联Q波和T波倒置），右室劳损（V1-V3导联T波倒置），电轴右偏，窦性心动过速。不完全性/完全性RBBB。',
        params: {
            heartRate: 105,
            rhythm: 'regular',
            rhythmType: 'sinus',
            prInterval: 160,
            qrsDuration: 95,
            qtInterval: 360,
            qtcInterval: 425,
            pAmplitude: 0.18,
            pDuration: 90,
            qrsAmplitude: 1.4,
            sWaveLeadI: true,
            qWaveLeadIII: true,
            tInvertedLeadIII: true,
            rbbbIncomplete: true,
            tAmplitude: 0.35,
            tInvertedV1V3: true,
            axis: 100, qrsAxis: 100, tAxis: 120,
            stElevation: 0,
            stDepression: 0,
            twaveShape: 'asymmetric',
        }
    },

    // ==================== EARLY REPOLARIZATION ====================
    'early_repolarization': {
        name: '早期复极',
        category: '正常变异',
        description: '早期复极：J点抬高，ST段凹面向上抬高（多见于V2-V5导联），QRS终末部可见J波（Osborn波）。常见于年轻健康男性。需与心包炎和STEMI鉴别。',
        params: {
            heartRate: 62,
            rhythm: 'regular',
            rhythmType: 'sinus',
            prInterval: 165,
            qrsDuration: 90,
            qtInterval: 410,
            qtcInterval: 415,
            pAmplitude: 0.15,
            pDuration: 90,
            qrsAmplitude: 1.6,
            jPointElevation: 0.2,
            jWave: { amplitude: 0.1, slurring: true },
            stElevation: 0.15,
            stShape: 'concave_upward',
            tAmplitude: 0.4,
            tTall: true,
            twaveShape: 'asymmetric_tall',
            qrsAxis: 40, pAxis: 50, tAxis: 45,
        }
    },
};

// Quick template categories for the UI
const TEMPLATE_CATEGORIES = [
    {
        name: '正常与变异',
        templates: ['normal_sinus', 'sinus_arrhythmia', 'early_repolarization']
    },
    {
        name: '心律失常',
        templates: [
            'sinus_bradycardia', 'sinus_tachycardia',
            'atrial_fibrillation', 'atrial_flutter', 'atrial_tachycardia',
            'premature_ventricular_complex',
            'ventricular_tachycardia', 'ventricular_fibrillation', 'torsades_de_pointes'
        ]
    },
    {
        name: '传导异常',
        templates: [
            'first_degree_av_block',
            'second_degree_av_block_type1', 'second_degree_av_block_type2',
            'third_degree_av_block',
            'left_bundle_branch_block', 'right_bundle_branch_block'
        ]
    },
    {
        name: '心肌缺血/梗死',
        templates: [
            'acute_anterior_mi', 'acute_inferior_mi', 'acute_lateral_mi',
            'acute_posterior_mi', 'subendocardial_ischemia', 'wellens_syndrome'
        ]
    },
    {
        name: '心室肥厚',
        templates: ['left_ventricular_hypertrophy', 'right_ventricular_hypertrophy']
    },
    {
        name: '电解质紊乱',
        templates: ['hyperkalemia', 'hypokalemia', 'hypercalcemia', 'hypocalcemia']
    },
    {
        name: '其他',
        templates: [
            'long_qt_syndrome', 'brugada_syndrome',
            'acute_pericarditis', 'pulmonary_embolism', 'ventricular_paced'
        ]
    }
];

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ECG_TEMPLATES, TEMPLATE_CATEGORIES };
}
