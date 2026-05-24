export const ECG_TEMPLATES = {

    'normal_sinus': {
        name: '正常窦性心律',
        category: '正常',
        description: '正常窦性心律，P波在I、II、aVF导联直立，aVR导联倒置。PR间期120-200ms，QRS时限<110ms，ST段等电位，T波与QRS主波方向一致。',
        params: {
            heartRate: 72, rhythm: 'regular', rhythmType: 'sinus',
            prInterval: 160, qrsDuration: 90, qtInterval: 390, qtcInterval: 400,
            pAmplitude: 0.15, pDuration: 90, pAxis: 50,
            qrsAmplitude: 1.5, qrsAxis: 30,
            tAmplitude: 0.3, tAxis: 40,
            stElevation: 0, stDepression: 0, stSlope: 'flat',
            twaveShape: 'asymmetric', uWavePresent: false,
        }
    },

    'sinus_bradycardia': {
        name: '窦性心动过缓',
        category: '心律失常',
        description: '窦性心律，心率<60bpm。P波形态正常，PR间期正常，每个P波后跟随QRS波。常见于运动员、睡眠状态或迷走神经张力增高。',
        params: {
            heartRate: 48, rhythm: 'regular', rhythmType: 'sinus',
            prInterval: 170, qrsDuration: 90, qtInterval: 440, qtcInterval: 395,
            pAmplitude: 0.15, pDuration: 95, qrsAmplitude: 1.4,
            tAmplitude: 0.35, stElevation: 0, stDepression: 0, stSlope: 'flat',
            twaveShape: 'asymmetric', qrsAxis: 30, pAxis: 50, tAxis: 40,
        }
    },

    'sinus_tachycardia': {
        name: '窦性心动过速',
        category: '心律失常',
        description: '窦性心律，心率>100bpm。P波形态可略高尖，PR间期可略缩短。需排除发热、贫血、甲亢、心衰等病因。',
        params: {
            heartRate: 115, rhythm: 'regular', rhythmType: 'sinus',
            prInterval: 140, qrsDuration: 85, qtInterval: 320, qtcInterval: 410,
            pAmplitude: 0.18, pDuration: 85, qrsAmplitude: 1.5, tAmplitude: 0.25,
            stElevation: 0, stDepression: -0.03, stSlope: 'upsloping',
            twaveShape: 'symmetric_peaked',
            reciprocalChanges: { leads: ['II','III','aVF'], stDepression: 0.15 },
            qrsAxis: 25, pAxis: 50, tAxis: 40,
        }
    },

    'sinus_arrhythmia': {
        name: '窦性心律不齐',
        category: '正常变异',
        description: '窦性心律不齐（呼吸性窦性心律不齐）：窦性P波形态正常，PR间期一致，但PP间期随呼吸周期变化。吸气时心率增快，呼气时心率减慢。',
        params: {
            heartRate: 72, rhythm: 'regular', rhythmType: 'sinus_arrhythmia',
            respiratoryVariation: 15,
            prInterval: 165, qrsDuration: 90, qtInterval: 395, qtcInterval: 405,
            pAmplitude: 0.15, pDuration: 90, qrsAmplitude: 1.4, tAmplitude: 0.3,
            stElevation: 0, stDepression: 0, stSlope: 'flat',
            twaveShape: 'asymmetric', qrsAxis: 30, pAxis: 50, tAxis: 40,
        }
    },

    'atrial_fibrillation': {
        name: '心房颤动',
        category: '心律失常',
        description: '心房颤动：P波消失，代之以大小、形态、间期不规则的f波（颤动波），频率350-600bpm。RR间期绝对不齐。QRS形态通常正常。',
        params: {
            heartRate: 90, rhythm: 'irregularly_irregular', rhythmType: 'atrial_fibrillation',
            pPresent: false, qrsDuration: 88, qtInterval: 380, qtcInterval: 420,
            qrsAmplitude: 1.4, tAmplitude: 0.28,
            stElevation: 0, stDepression: 0, stSlope: 'flat',
            twaveShape: 'asymmetric',
            fibrillationWaves: { amplitude: 0.08, frequency: 400 },
            rrVariation: { min: 0.5, max: 1.1 },
            qrsAxis: 25, tAxis: 40,
        }
    },

    'atrial_flutter': {
        name: '心房扑动',
        category: '心律失常',
        description: '心房扑动：P波消失代以锯齿状F波（扑动波），频率250-350bpm，在II、III、aVF导联最明显。典型的房室传导比率为2:1或3:1。',
        params: {
            heartRate: 100, rhythm: 'regular', rhythmType: 'atrial_flutter',
            pPresent: false, qrsDuration: 88, qtInterval: 370, qtcInterval: 420,
            qrsAmplitude: 1.4, tAmplitude: 0.28,
            stElevation: 0, stDepression: 0, stSlope: 'flat',
            twaveShape: 'asymmetric',
            flutterWaves: { amplitude: 0.25, frequency: 300, conductionRatio: 3 },
            qrsAxis: 25, tAxis: 40,
        }
    },

    'atrial_tachycardia': {
        name: '房性心动过速',
        category: '心律失常',
        description: '房性心动过速：心房率150-250bpm，P波形态不同于窦性（异位起搏点），可隐藏在T波内导致假性T波异常。房室传导通常1:1。',
        params: {
            heartRate: 160, rhythm: 'regular', rhythmType: 'atrial',
            prInterval: 140, qrsDuration: 85, qtInterval: 300, qtcInterval: 420,
            pAmplitude: 0.18, pDuration: 80, qrsAmplitude: 1.4, tAmplitude: 0.25,
            stElevation: 0, stDepression: -0.03, stSlope: 'upsloping',
            twaveShape: 'asymmetric', qrsAxis: 25, pAxis: 60, tAxis: 40,
        }
    },

    'premature_ventricular_complex': {
        name: '室性早搏',
        category: '心律失常',
        description: '室性早搏：QRS波提前出现、宽大畸形（>120ms），其前无P波，T波方向与QRS主波相反。完全性代偿间歇。',
        params: {
            heartRate: 72, rhythm: 'regular', rhythmType: 'sinus_with_pvc',
            prInterval: 160, qrsDuration: 90, qtInterval: 390, qtcInterval: 400,
            pAmplitude: 0.15, pDuration: 90, qrsAmplitude: 1.5,
            tAmplitude: 0.3, stElevation: 0, stDepression: 0, stSlope: 'flat',
            twaveShape: 'asymmetric',
            pvcFrequency: 6, pvcQrsDuration: 140, pvcMorphology: 'uniform',
            qrsAxis: 30, pAxis: 50, tAxis: 40,
        }
    },

    'ventricular_tachycardia': {
        name: '室性心动过速',
        category: '心律失常',
        description: '室性心动过速：连续≥3个室性早搏，频率>100bpm，QRS>120ms，宽大畸形。房室分离：P波独立于QRS波出现。',
        params: {
            heartRate: 150, rhythm: 'regular', rhythmType: 'ventricular',
            pPresent: false, qrsDuration: 145, qtInterval: 300, qtcInterval: 410,
            qrsAmplitude: 2.0, qrsMorphology: 'wide_bizarre',
            tAmplitude: 0.4, tDirection: 'opposite', twaveShape: 'opposite_qrs',
            stDiscordant: true, stElevation: 0, stDepression: 0,
            qrsAxis: -75, tAxis: 100,
        }
    },

    'ventricular_fibrillation': {
        name: '心室颤动',
        category: '心律失常',
        description: '心室颤动：QRS波消失，代之以极不规则的、频率极快的紊乱波形。粗颤：振幅>0.5mV，细颤：振幅<0.2mV。心脏泵血功能丧失。',
        params: {
            heartRate: 0, rhythm: 'chaotic', rhythmType: 'ventricular_fibrillation',
            pPresent: false, qrsDuration: 0, qtInterval: 0,
            qrsAmplitude: 0.5, tAmplitude: 0,
            vfAmplitude: { coarse: true, irregular: true },
            qrsAxis: 30,
        }
    },

    'torsades_de_pointes': {
        name: '尖端扭转型室速',
        category: '心律失常',
        description: '尖端扭转型室速：QRS波围绕等电位线扭转，振幅呈周期性增减变化。频率200-250bpm，常发生于长QT背景上。',
        params: {
            heartRate: 215, rhythm: 'regular', rhythmType: 'torsades',
            pPresent: false, qrsDuration: 120, qtInterval: 280, qtcInterval: 510,
            qrsAmplitude: 1.8, tAmplitude: 0.3,
            torsadesEnvelope: true,
            stElevation: 0, stDepression: 0,
            qrsAxis: 30,
        }
    },

    'first_degree_av_block': {
        name: '一度房室传导阻滞',
        category: '传导异常',
        description: '一度房室传导阻滞：PR间期>200ms（成人），每个P波后均有QRS波。PR间期固定延长，1:1房室传导。',
        params: {
            heartRate: 70, rhythm: 'regular', rhythmType: 'sinus',
            prInterval: 260, qrsDuration: 90, qtInterval: 400, qtcInterval: 410,
            pAmplitude: 0.15, pDuration: 90, qrsAmplitude: 1.5,
            tAmplitude: 0.3, stElevation: 0, stDepression: 0, stSlope: 'flat',
            twaveShape: 'asymmetric', qrsAxis: 30, pAxis: 50, tAxis: 40,
        }
    },

    'second_degree_av_block_type1': {
        name: '二度I型AVB（文氏）',
        category: '传导异常',
        description: '文氏型二度AVB：PR间期逐渐延长，直至一个P波后QRS脱落（阻滞），然后周而复始。典型的呈文氏周期性。',
        params: {
            heartRate: 65, rhythm: 'regular', rhythmType: 'sinus_with_wenckebach',
            prBaseInterval: 180, prIncrement: 40, droppedBeatEvery: 4,
            qrsDuration: 90, qtInterval: 400, qtcInterval: 410,
            pAmplitude: 0.15, pDuration: 90, qrsAmplitude: 1.4,
            tAmplitude: 0.3, stElevation: 0, stDepression: 0, stSlope: 'flat',
            twaveShape: 'asymmetric', qrsAxis: 30, pAxis: 50, tAxis: 40,
        }
    },

    'second_degree_av_block_type2': {
        name: '二度II型AVB（Mobitz II）',
        category: '传导异常',
        description: 'Mobitz II型二度AVB：PR间期固定（正常或延长），突然出现P波后QRS脱落。阻滞水平通常在希氏束或以下。',
        params: {
            heartRate: 60, rhythm: 'irregular', rhythmType: 'sinus_with_mobitz2',
            prInterval: 220, droppedBeatEvery: 3,
            qrsDuration: 100, qtInterval: 410, qtcInterval: 420,
            pAmplitude: 0.15, pDuration: 90, qrsAmplitude: 1.4,
            tAmplitude: 0.3, stElevation: 0, stDepression: 0, stSlope: 'flat',
            twaveShape: 'asymmetric', qrsAxis: 30, pAxis: 50, tAxis: 40,
        }
    },

    'third_degree_av_block': {
        name: '三度房室传导阻滞',
        category: '传导异常',
        description: '完全性房室传导阻滞：P波与QRS波完全无关（房室分离），心房率>心室率。逸搏心律可为交界性或室性。',
        params: {
            heartRate: 40, rhythm: 'av_dissociation', rhythmType: 'complete_heart_block',
            atrialRate: 75, ventricularRate: 40, junctionalQrs: true,
            qrsDuration: 105, qtInterval: 460, qtcInterval: 430,
            pAmplitude: 0.15, pDuration: 90, qrsAmplitude: 1.5,
            tAmplitude: 0.32, stElevation: 0, stDepression: 0, stSlope: 'flat',
            twaveShape: 'asymmetric', qrsAxis: 25, pAxis: 50, tAxis: 40,
        }
    },

    'left_bundle_branch_block': {
        name: '左束支传导阻滞',
        category: '传导异常',
        description: 'LBBB：QRS≥120ms，V1导联rS或QS型，V6导联R波宽大、切迹。I、aVL导联R波宽大。电轴左偏，继发性ST-T改变。',
        params: {
            heartRate: 72, rhythm: 'regular', rhythmType: 'sinus',
            prInterval: 165, qrsDuration: 145, qtInterval: 420, qtcInterval: 435,
            pAmplitude: 0.15, pDuration: 90,
            qrsAmplitude: 2.0, qrsNotching: true, stDiscordant: true,
            tAmplitude: 0.35, tDirection: 'opposite', twaveShape: 'opposite_qrs',
            stElevation: 0, stDepression: 0, stSlope: 'flat',
            qrsAxis: -45, pAxis: 50, tAxis: 120,
        }
    },

    'right_bundle_branch_block': {
        name: '右束支传导阻滞',
        category: '传导异常',
        description: `RBBB：QRS≥120ms，V1导联rsR′型（"兔耳"征），V6导联宽大S波。电轴可正常或右偏。`,
        params: {
            heartRate: 72, rhythm: 'regular', rhythmType: 'sinus',
            prInterval: 165, qrsDuration: 135, qtInterval: 410, qtcInterval: 425,
            pAmplitude: 0.15, pDuration: 90,
            qrsAmplitude: 1.5, rbbbRsrPattern: true, terminalR: 0.35, sWaveBroad: true,
            tAmplitude: 0.3, stElevation: 0, stDepression: 0, stSlope: 'flat',
            twaveShape: 'asymmetric', qrsAxis: 35, pAxis: 50, tAxis: 40,
        }
    },

    'acute_anterior_mi': {
        name: '急性前壁心肌梗死',
        category: '心肌缺血/梗死',
        description: '急性前壁STEMI：V1-V4导联ST段抬高≥2mm（男<40岁）或≥1.5mm（女性），可伴对应性下壁ST段压低。左前降支闭塞所致。',
        params: {
            heartRate: 80, rhythm: 'regular', rhythmType: 'sinus',
            prInterval: 160, qrsDuration: 90, qtInterval: 390, qtcInterval: 420,
            pAmplitude: 0.15, pDuration: 90, qrsAmplitude: 1.5,
            qWave: { depth: 0.25, duration: 0.04, leads: ['V1','V2','V3','V4'] },
            stElevation: 0.3, stShape: 'coved_upward',
            tAmplitude: 0.35, twaveShape: 'symmetric_peaked',
            reciprocalChanges: { leads: ['II','III','aVF'], stDepression: 0.1 },
            qrsAxis: 30, pAxis: 50, tAxis: 40,
        }
    },

    'acute_inferior_mi': {
        name: '急性下壁心肌梗死',
        category: '心肌缺血/梗死',
        description: '急性下壁STEMI：II、III、aVF导联ST段抬高≥1mm。III导联抬高幅度常>II导联。对应前壁/高侧壁导联ST段压低。需加做右胸导联排除右室梗死。',
        params: {
            heartRate: 70, rhythm: 'regular', rhythmType: 'sinus',
            prInterval: 165, qrsDuration: 90, qtInterval: 400, qtcInterval: 410,
            pAmplitude: 0.15, pDuration: 90, qrsAmplitude: 1.4,
            qWave: { depth: 0.25, duration: 0.04, leads: ['II','III','aVF'] },
            stElevation: 0.25, stShape: 'straight',
            tAmplitude: 0.35, twaveShape: 'symmetric_peaked',
            reciprocalChanges: { leads: ['I','aVL'], stDepression: 0.1 },
            qrsAxis: 30, pAxis: 50, tAxis: 40,
        }
    },

    'acute_lateral_mi': {
        name: '急性侧壁心肌梗死',
        category: '心肌缺血/梗死',
        description: '急性侧壁STEMI：I、aVL、V5、V6导联ST段抬高≥1mm。可能由回旋支闭塞引起。需注意高侧壁（I、aVL）改变。',
        params: {
            heartRate: 78, rhythm: 'regular', rhythmType: 'sinus',
            prInterval: 160, qrsDuration: 92, qtInterval: 390, qtcInterval: 415,
            pAmplitude: 0.15, pDuration: 90, qrsAmplitude: 1.5,
            qWave: { depth: 0.2, duration: 0.04, leads: ['I','aVL','V5','V6'] },
            stElevation: 0.2, stShape: 'straight',
            tAmplitude: 0.3, twaveShape: 'symmetric_peaked',
            reciprocalChanges: { leads: ['III','aVF'], stDepression: 0.08 },
            qrsAxis: -30, pAxis: 50, tAxis: 40,
        }
    },

    'acute_posterior_mi': {
        name: '急性后壁心肌梗死',
        category: '心肌缺血/梗死',
        description: '急性后壁STEMI：V1-V3导联出现对应性改变——ST段压低、R波增高增宽、T波直立高大。V7-V9导联可见ST段抬高。',
        params: {
            heartRate: 75, rhythm: 'regular', rhythmType: 'sinus',
            prInterval: 165, qrsDuration: 90, qtInterval: 395, qtcInterval: 415,
            pAmplitude: 0.15, pDuration: 90, qrsAmplitude: 1.6,
            rWaveProminent: { leads: ['V1','V2'], duration: 0.05, amplitude: 0.8 },
            stDepression: -0.15, stDepressionLeads: ['V1','V2','V3'],
            tAmplitude: 0.4, tUprightProminent: true, twaveShape: 'tall_upright',
            qrsAxis: 30, pAxis: 50, tAxis: 40,
        }
    },

    'subendocardial_ischemia': {
        name: '心内膜下缺血',
        category: '心肌缺血/梗死',
        description: '心内膜下缺血：多导联ST段水平型或下斜型压低，伴T波低平或倒置。运动负荷试验时常见。需除外NSTEMI。',
        params: {
            heartRate: 80, rhythm: 'regular', rhythmType: 'sinus',
            prInterval: 160, qrsDuration: 90, qtInterval: 390, qtcInterval: 420,
            pAmplitude: 0.15, pDuration: 90, qrsAmplitude: 1.4,
            stElevation: 0, stDepression: -0.2, stSlope: 'horizontal', stShape: 'horizontal_depression',
            tAmplitude: 0.15, tLowAmplitude: true, twaveShape: 'flat_inverted',
            qrsAxis: 25, pAxis: 50, tAxis: 45,
        }
    },

    'wellens_syndrome': {
        name: 'Wellens综合征',
        category: '心肌缺血/梗死',
        description: 'Wellens综合征：V2-V3导联（可扩展至V1-V6）T波深倒置（A型）或正负双向（B型），无明显ST段抬高，提示左前降支近端严重狭窄，为STEMI前兆。',
        params: {
            heartRate: 75, rhythm: 'regular', rhythmType: 'sinus',
            prInterval: 165, qrsDuration: 88, qtInterval: 400, qtcInterval: 415,
            pAmplitude: 0.15, pDuration: 90, qrsAmplitude: 1.4,
            stElevation: 0, stDepression: 0,
            tAmplitude: 0.5, tInvertedDeep: true, tBiphasic: false,
            leadsInvolved: ['V2','V3','V4'],
            twaveShape: 'deep_symmetric_inverted',
            qrsAxis: 30, pAxis: 50, tAxis: 40,
        }
    },

    'left_ventricular_hypertrophy': {
        name: '左心室肥厚',
        category: '心室肥厚',
        description: 'LVH电压标准：SV1+RV5/RV6>35mm（Sokolow-Lyon标准）或aVL R波>11mm。伴左室高电压、ST-T继发性改变（劳损型）。电轴左偏常见。',
        params: {
            heartRate: 68, rhythm: 'regular', rhythmType: 'sinus',
            prInterval: 170, qrsDuration: 105, qtInterval: 420, qtcInterval: 425,
            pAmplitude: 0.2, pDuration: 100, leftAtrialEnlargement: true,
            qrsAmplitude: 3.0, highVoltage: true, strainPattern: true,
            tAmplitude: 0.5, tInverted: true, tAsymmetricInverted: true,
            stDepression: -0.1, stSlope: 'downsloping',
            twaveShape: 'lv_strain', qrsAxis: -15,
        }
    },

    'right_ventricular_hypertrophy': {
        name: '右心室肥厚',
        category: '心室肥厚',
        description: 'RVH：电轴右偏>110°，V1导联R/S>1，V1 R波>7mm，V5-V6导联S波加深。ST-T改变在右胸导联。常见于慢性肺心病、先天性心脏病。',
        params: {
            heartRate: 78, rhythm: 'regular', rhythmType: 'sinus',
            prInterval: 165, qrsDuration: 95, qtInterval: 390, qtcInterval: 410,
            pAmplitude: 0.25, pDuration: 100, pPulmonale: true,
            qrsAmplitude: 1.8, v1DominantR: true, v1RAmplitude: 0.8,
            tAmplitude: 0.3, tInverted: true, tInvertedV1V3: true,
            stDepression: -0.05, stSlope: 'downsloping',
            twaveShape: 'rv_strain', qrsAxis: 120,
        }
    },

    'hyperkalemia': {
        name: '高钾血症',
        category: '电解质紊乱',
        description: '高钾血症心电演变：T波高尖对称（血钾5.5-6.5mmol/L）→P波低平增宽、PR延长→P波消失（血钾>7.5）→QRS增宽呈正弦波形（血钾>8.0），可致室颤/心脏停搏。',
        params: {
            heartRate: 75, rhythm: 'regular', rhythmType: 'sinus',
            prInterval: 190, qrsDuration: 100, qtInterval: 380, qtcInterval: 400,
            pAmplitude: 0.08, pDuration: 100, pLowAmplitude: true,
            qrsAmplitude: 1.4,
            tAmplitude: 0.6, tPeaked: true, tNarrowBase: true, tSymmetry: true,
            twaveShape: 'peaked_symmetric_tented',
            qrsAxis: 30, pAxis: 50, tAxis: 30,
        }
    },

    'hypokalemia': {
        name: '低钾血症',
        category: '电解质紊乱',
        description: '低钾血症：T波低平或倒置、U波明显增高（>1mm或>T波高度）、ST段压低、QT间期延长（实际为QU间期延长）。严重时可出现室性心律失常。',
        params: {
            heartRate: 72, rhythm: 'regular', rhythmType: 'sinus',
            prInterval: 165, qrsDuration: 90, qtInterval: 410, qtcInterval: 420,
            pAmplitude: 0.15, pDuration: 90, qrsAmplitude: 1.4,
            tAmplitude: 0.1, tFlattened: true,
            uWaveAmplitude: 0.2, uWavePresent: true, uWaveProminent: true,
            stDepression: -0.08, stSlope: 'downsloping',
            twaveShape: 'flat_u_wave',
            qrsAxis: 25, pAxis: 50, tAxis: 40,
        }
    },

    'hypercalcemia': {
        name: '高钙血症',
        category: '电解质紊乱',
        description: '高钙血症：QT间期缩短（ST段缩短），T波可正常或增宽。严重高钙时QRS可增宽、PR延长。特征性"短QT"。',
        params: {
            heartRate: 75, rhythm: 'regular', rhythmType: 'sinus',
            prInterval: 160, qrsDuration: 88, qtInterval: 340, qtcInterval: 355,
            pAmplitude: 0.15, pDuration: 90, qrsAmplitude: 1.4,
            tAmplitude: 0.3, stShort: true,
            twaveShape: 'asymmetric', qrsAxis: 30, pAxis: 50, tAxis: 40,
        }
    },

    'hypocalcemia': {
        name: '低钙血症',
        category: '电解质紊乱',
        description: '低钙血症：QT间期延长（ST段延长），T波形态正常或低平。QTc显著延长，主要由ST段延长引起。需警惕尖端扭转型室速风险。',
        params: {
            heartRate: 72, rhythm: 'regular', rhythmType: 'sinus',
            prInterval: 170, qrsDuration: 90, qtInterval: 460, qtcInterval: 480,
            pAmplitude: 0.15, pDuration: 90, qrsAmplitude: 1.4,
            tAmplitude: 0.25, stSegmentProlonged: true,
            twaveShape: 'asymmetric', qrsAxis: 30, pAxis: 50, tAxis: 40,
        }
    },

    'long_qt_syndrome': {
        name: '长QT综合征',
        category: '离子通道病',
        description: '长QT综合征：QTc男性>450ms、女性>460ms。LQT1为宽大T波，LQT2为双峰T波，LQT3为晚发高尖T波。有尖端扭转型室速风险。',
        params: {
            heartRate: 65, rhythm: 'regular', rhythmType: 'sinus',
            prInterval: 165, qrsDuration: 90, qtInterval: 500, qtcInterval: 510,
            pAmplitude: 0.15, pDuration: 90, qrsAmplitude: 1.4,
            tAmplitude: 0.35, tNotched: true, tBroadBased: true,
            twaveShape: 'broad_biphasic_notched',
            qrsAxis: 30, pAxis: 50, tAxis: 40,
        }
    },

    'brugada_syndrome': {
        name: 'Brugada综合征',
        category: '离子通道病',
        description: 'Brugada综合征：V1-V3导联ST段呈穹窿型（1型）或马鞍型（2型）抬高≥2mm，伴T波倒置。不完全性右束支传导阻滞样改变。SCN5A基因突变相关。',
        params: {
            heartRate: 70, rhythm: 'regular', rhythmType: 'sinus',
            prInterval: 170, qrsDuration: 100, qtInterval: 390, qtcInterval: 405,
            pAmplitude: 0.15, pDuration: 90, qrsAmplitude: 1.4,
            brugadaPattern: 'type1', stElevation: 0.3, stShape: 'coved', jPointElevation: 0.25,
            tInverted: true, twaveShape: 'brugada_inverted',
            qrsAxis: 30, pAxis: 50, tAxis: 40,
        }
    },

    'acute_pericarditis': {
        name: '急性心包炎',
        category: '心包疾病',
        description: '急性心包炎：广泛导联ST段凹面向上抬高（除aVR和V1外），PR段压低，无对应性ST段压低（与STEMI鉴别要点）。后期T波可倒置。',
        params: {
            heartRate: 95, rhythm: 'regular', rhythmType: 'sinus',
            prInterval: 155, qrsDuration: 88, qtInterval: 370, qtcInterval: 420,
            pAmplitude: 0.15, pDuration: 90, qrsAmplitude: 1.3,
            stElevation: 0.15, stShape: 'concave_upward', stDiffuse: true, prDepression: 0.05,
            tAmplitude: 0.25, twaveShape: 'asymmetric',
            qrsAxis: 25, pAxis: 50, tAxis: 40,
        }
    },

    'pulmonary_embolism': {
        name: '肺栓塞心电图表现',
        category: '肺血管疾病',
        description: '急性肺栓塞：SIQIIITIII（I导联S波加深、III导联Q波和T波倒置），右室劳损（V1-V3导联T波倒置），电轴右偏，窦性心动过速。不完全性/完全性RBBB。',
        params: {
            heartRate: 105, rhythm: 'regular', rhythmType: 'sinus',
            prInterval: 160, qrsDuration: 95, qtInterval: 360, qtcInterval: 425,
            pAmplitude: 0.18, pDuration: 90, qrsAmplitude: 1.4,
            sWaveLeadI: true, qWaveLeadIII: true, tInvertedLeadIII: true,
            rbbbIncomplete: true,
            tAmplitude: 0.35, tInvertedV1V3: true,
            qrsAxis: 100, tAxis: 120,
            stElevation: 0, stDepression: 0, twaveShape: 'asymmetric',
        }
    },

    'early_repolarization': {
        name: '早期复极',
        category: '正常变异',
        description: '早期复极：J点抬高，ST段凹面向上抬高（多见于V2-V5导联），QRS终末部可见J波（Osborn波）。常见于年轻健康男性。需与心包炎和STEMI鉴别。',
        params: {
            heartRate: 62, rhythm: 'regular', rhythmType: 'sinus',
            prInterval: 165, qrsDuration: 90, qtInterval: 410, qtcInterval: 415,
            pAmplitude: 0.15, pDuration: 90, qrsAmplitude: 1.6,
            jPointElevation: 0.2, jWave: { amplitude: 0.1, slurring: true },
            stElevation: 0.15, stShape: 'concave_upward',
            tAmplitude: 0.4, tTall: true,
            twaveShape: 'asymmetric_tall',
            qrsAxis: 40, pAxis: 50, tAxis: 45,
        }
    },

    'ventricular_paced': {
        name: '心室起搏心律',
        category: '起搏器',
        description: '心室起搏心电图：起搏信号（钉样信号）在前，其后跟随宽大畸形QRS波（类似LBBB形态因为右室心尖部起搏）。可见房室顺序起搏或单纯心室起搏。',
        params: {
            heartRate: 70, rhythm: 'regular', rhythmType: 'paced',
            prInterval: null, qrsDuration: 160, qtInterval: 430, qtcInterval: 440,
            pPresent: false,
            paceSpike: { amplitude: 0.3, duration: 2 },
            qrsAmplitude: 1.8, qrsMorphology: 'paced_lbbb',
            tAmplitude: 0.35, tDirection: 'opposite', twaveShape: 'opposite_qrs',
            qrsAxis: -60, tAxis: 120,
        }
    },
};

export const TEMPLATE_CATEGORIES = [
    { name: '正常与变异', templates: ['normal_sinus', 'sinus_arrhythmia', 'early_repolarization'] },
    { name: '心律失常', templates: ['sinus_bradycardia', 'sinus_tachycardia', 'atrial_fibrillation', 'atrial_flutter', 'atrial_tachycardia', 'premature_ventricular_complex', 'ventricular_tachycardia', 'ventricular_fibrillation', 'torsades_de_pointes'] },
    { name: '传导异常', templates: ['first_degree_av_block', 'second_degree_av_block_type1', 'second_degree_av_block_type2', 'third_degree_av_block', 'left_bundle_branch_block', 'right_bundle_branch_block'] },
    { name: '心肌缺血/梗死', templates: ['acute_anterior_mi', 'acute_inferior_mi', 'acute_lateral_mi', 'acute_posterior_mi', 'subendocardial_ischemia', 'wellens_syndrome'] },
    { name: '心室肥厚', templates: ['left_ventricular_hypertrophy', 'right_ventricular_hypertrophy'] },
    { name: '电解质紊乱', templates: ['hyperkalemia', 'hypokalemia', 'hypercalcemia', 'hypocalcemia'] },
    { name: '其他', templates: ['long_qt_syndrome', 'brugada_syndrome', 'acute_pericarditis', 'pulmonary_embolism', 'ventricular_paced'] },
];
