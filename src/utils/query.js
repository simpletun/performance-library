/*
TODO: Break this file out where possible.
This file is only around for posterity. Over time, we should remove this file in favor of separating logic out to
modules. Hard coded data should be replaced with reference data where possible.
 */

import { randomItem, randomItems, randomItemWeightedArray, randomCharacters, randomInt } from './random';

export const regions = {
	global: [ 0 ],
	geography: [ 79, 4, 69, 76 ],
	country: [133, 214, 186, 104, 107, 102, 103, 105, 98, 101, 90, 91, 106, 97, 92, 96, 84, 85, 95, 100, 82, 94, 87, 86, 83, 89, 93, 88, 53, 60, 51, 46, 48, 30, 31, 29, 27, 26, 28, 25, 24, 21, 20, 23, 22, 19, 18, 3, 8, 7, 225, 227]
};

export const countriesByGeo = {
	4: [51, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 100, 101, 102, 103, 104, 105, 106, 107, 133, 186, 214, 225, 227],
	69: [3, 7],
	76: [8, 20, 21, 22, 23, 24, 25, 26, 28, 29, 30, 31, 46, 48, 53, 60],
	79: [18, 19, 27]
};

export const bannerAccounts = ['00337', '00336', '00369', '00334', '00129', '00027', '00280', '00080'];
export const retailConcepts = ['27', '37', '38', '39', '41', '42', '43', '47', '48', '49', '34'];

// Placeholder filters
const silhouetteCodesByDiv = {'10': ['105', '108', '110', '115', '116', '118', '547', '548', '549', '042', '037', '080', '070', '055', '065', '045', '060', '040', '025', '036', '090', '085', '075', '050', '035', '030'],
	'20': ['015', '005', '010', '020'],
	'30': ['325', '395', '345', '205', '360', '510', '258', '215', '320', '225', '385', '220', '450', '370', '462', '405', '410', '358', '495', '308', '245', '415', '520', '350', '246']
};
const agesByDiv = {'10': ['10', '02', '07', '08'], '20': ['02', '08', '10', '20', '30'], '30': ['02', '07', '10', '30']};

// Primary Filter Types
const ageCodes = [ '10', '20', '30', '40', '02', '07', '08'];
const coreFocusCodes = ['2000', '2001', '2002', '2003', '2004', '2005', '2006', '2012', '2013', '2015', '2016', '2022', '2024'];
const genderCodes = [ '01', '02' ];
const divisionCodes = [ '10', '20', '30' ];

// Additional Filter Types
const merchlassificationAPIds = [24, 23, 22, 2, 5, 4, 14, 13, 18, 17];
const merchlassificationEQIds = [11, 6, 20, 21];
const platformCodes = [12, 10, 15, 20, 2, 27];
const marketingTypeCodes = [1, 2, 3, 4, 5, 6, 7, 31, 35];

// Common Obscure Filter Types
const accountCode = ['84', '61', '83', '102', '104', '290'];
const businessOrganizationCode = ['000178', '000197', '000198', '000207', '000045'];
const carryOver = [0, 1];
const consumerFocusId = [28, 44, 169, 32, 12, 6, 5, 32, 13, 168, 42];
const consumerGroupCode = [1, 2, 4, 20, 5, 21, 22];
const consumerPurposeCode = [71, 16, 3, 888, 17, 87, 92, 93];
const channelSegmentationIdList = [30, 113, 114, 19, 16, 27, 25, 29, 83, 73, 74, 75, 147, 150];
const marketingInitiativeIdList = [34, 550, 498, 549, 548, 612];
const merchForecastQuantityList = [1000, 2000, 3000, 4000, 5000, 10000, 20000];
const countryRestrictionIdList = [21, 23, 3, 7, 24, 20, 30, 27, 18, 19, 53, 26];

// Global Obscure Filter Types
const alwaysAvailable = [0, 1];
const categoryPlm = ['BTIERN', 'CYEMM','RSTEW3', 'KERICH', 'HMELHA', 'JSPEN1', 'DGOWEN', 'MSOUZA', 'JLEE41', 'KLEEPE',
	'CLOOKE', 'BLOECH', 'KGUILD', 'SSALLO', 'AWRISL', 'CCHIKE'];
const categorySummaryCode = ['1004', '1006', '1002', '1001', '1003', '1009', '1010', '1005', '1011', '1012', '1007'];
const channelSegmentationId = channelSegmentationIdList.slice();
const developmentTeamId = [212, 287, 217, 18, 213, 13, 12, 8, 17, 23, 289];
const fitCode = ['WF', 'GF', 'AS'];
const geoRestrictionId = regions.geography.slice();
const marketingInitiativeId = marketingInitiativeIdList.slice();
const initiatorId = [1, 23, 6, 21];
const leagueId = [1, 3, 14, 28, 27, 2];
// const licensed = []; // all null so far
const marketingName = ['AIR MAX', 'AIR FORCE', 'NIKE SFB', 'FORCE', 'AIR DIAMOND', 'MONARCH',
	'LUNCAR', 'VAPOR', 'VAPOR TECH', 'TEMPO', 'SF9 NFL'];
const modelGroupId = [184, 32, 6, 15, 13, 17, 59];
const modelGroupTypeId = [42, 2, 4, 5, 22];
const modelId = [104852, 104772, 104754, 104732, 104752, 104871, 104736, 104780, 110580,
	104765, 104767, 104864, 105880, 132830, 104863, 137502, 134492, 136028, 136056,
	104872, 103414, 113461, 115784, 104856];
const modelName = ['CORE', 'CREW', 'LMTD', 'HYPERSPEED', 'VAPOR', 'TEMPO', 'TANK', 'SHORT', 'JORDAN'];
const moStatus = [0, 1];
const productCategoryCode = ['000233', '000756', '000712', '000002', '000364', '000013',
	'000005', '000713', '000778', '000757', '000716', '000710', '000787', '000386', '000777'];
const productId = [2872635, 3416731, 3231456, 3317250];
const productSubCategoryCode = ['004383', '001517', '004325', '004382', '005032', '005049',
	'004339', '004249', '000161', '003079', '002730', '002195', '004246'];
const silhouetteCode = ['050', '055', '105', '075', '060', '110', '010', '090', '430', '080'];
const siloId = [509, 596, 351, 511, 1, 348, 488, 352];
const sportActivityCode = ['14', '45', '52', '02', '09', '13', '30', '28', '46', '15', '29'];
const sportLevelId = [1, 2, 3, 5, 6];
const styleNumber = ['AQ9954', '905723', '831559', '831558', '705187', 'PAC278', '705186',
	'919711', 'AR5331', '919789', '919700'];
const teamId = [4097, 4098, 4096, 4114, 394, 4094, 4099, 479, 4100, 4103, 480, 4104, 4107, 482];
const tierId = [7, 8, 9, 5, 3, 4];
const collectionIds = [30,31,32,807,1027,1063,1065,2140,2141,2142,2194,2195,2196,2222,2237,2248,2252,2254,2268,2276,2288,2289,2296,2302,2311,2312,2324,2325,2329,2333,2338,2348,2701,2707,2711,2741,2749,2793,2796,2797,2798,2799,2800,2801,2802,2803,2804,2805,2806,2807,2808,2809,2810,2811,2812,2813,2814,2815,2816,2817,2818,2819,2820,2828,2832,2836,2840,2845,2847,2855,2856,2857,2858,2860,2861,2862,2863,2864,2865,2866,2867,2868,2869,2870,2885,2887,2888,2889,2890,2893,2894,2896,2897,2898,2899,2900,2901,2902,2905,2906,2907,2908,2909,2911,2912,2913,2914,2915,2916,2917,2918,2921,2924,2925,2927,2930,2931,2932,2933,2934,2943,2960,2967,2982,2986,3003,3004,3005,3006,3007,3008,3009,3010,3011,3029,3030,3031,3033,3034,3039,3086,3092,3106,3107,3108,3111,3118,3122,3123,3125,3127,3128,3130,3134,3135,3136,3137,3138,3139,3140,3141,3142,3143,3144,3145,3146,3147,3148,3149,3150,3151,3152,3153,3154,3155,3156,3157,3158,3159,3161,3171,3189,3190,3196,3201,3210,3240,3241,3259,3261,3262,3263,3305,3335,3336,3345,3355,3449,3450,3456,3458,3476,3490,3500,3501,3502,3503,3544,3545,3551,3552,3553,3554,3555,3556,3557,3558,3564,3565,3573,3591,3592,3593,3595,3596,3597,3599,3600,3601,3602,3603,3604,3605,3606,3607,3608,3609,3610,3611,3612,3613,3617,3618,3619,3620,3621,3622,3623,3624,3625,3628,3629,3630,3631,3632,3633,3639,3642,3650,3651,3652,3653,3654,3655,3656,3657,3658,3659,3660,3661,3662,3663,3665,3666,3667,3668,3669,3670,3671,3672,3676,3684,3688,3693,3700,3701,3702,3703,3704,3705,3716,3717,3718,3720,3724,3725,3726,3727,3729,3733,3734,3735,3737,3741,3742,3744,3746,3747,3748,3749,3750,3751,3753,3754,3755,3756,3757,3759,3769,3770,3771,3772,3773,3774,3775,3778,3779,3780,3781,3782,3783,3784,3785,3787,3789,3790,3799,3801,3803,3804,3805,3808,3809,3816,3818,3819,3821,3823,3824,3825,3830,3832,3834,3835,3837,3839,3841,3842,3843,3845,3846,3848,3851,3852,3853,3854,3858,3860,3861,3865,3866,3867,3869,3870,3873,3874,3875,3876,3879,3880,3881,3882,3883,3884,3887,3888,3889,3890,3891,3892,3893,3894,3895,3896,3897,3898,3899,3900,3902,3903,3904,3905,3906,3907,3910,3912,3914,3915,3916,3917,3918,3919,3921,3922,3923,3924,3925,3926,3927,3928,3929,3930,3931,3932,3933,3937,3938,3939,3940,3941,3942,3943,3944,3945,3952,3953,3954,3961,3971,3972,3975,3976,3979,3980,3981,3982,3983,3984,3985,3986,3987,3988,3989,3992,3994,3995,3996,3998,4000,4001,4002,4003,4004,4005,4006,4007,4008,4009,4010,4011,4012,4013,4014,4015,4029,4030,4031,4032,4033,4034,4035,4036,4037,4038,4039,4040,4041,4042,4043,4044,4045,4046,4047,4048,4049,4050,4051,4062,4063,4064,4065,4066,4067,4068,4069,4071,4072,4078,4085,4087,4088,4090,4092,4094,4116,4126,4128,4132,4133,4139,4140,4141,4142,4143,4144,4148,4149,4150,4151,4152,4153,4154,4155,4156,4157,4158,4159,4161,4162,4163,4164,4165,4166,4167,4173,4174,4175,4176,4177,4178,4182,4183,4184,4185,4187,4188,4191,4192,4193,4194,4195,4196,4200,4201,4204,4208,4209,4210,4211,4218,4219,4221,4222,4223,4224,4225,4226,4227,4228,4229,4230,4233,4234,4237,4239,4240,4244,4245,4246,4266,4267,4268,4269,4270,4271,4272,4281,4282,4284,4285,4286,4287,4289,4292,4297,4303,4304,4308,4309,4310,4311,4312,4313,4314,4315,4316,4317,4318,4319,4320,4321,4322,4323,4324,4326,4327,4328,4329,4330,4331,4332,4333,4334,4335,4336,4337,4338,4339,4340,4341,4347,4350,4351,4352,4355,4356,4357,4358,4359,4360,4361,4362,4363,4364,4365,4366,4367,4368,4371,4372,4373,4374,4375,4376,4377,4385,4387,4389,4390,4391,4392,4393,4394,4395,4398,4399,4400,4401,4402,4403,4404,4405,4406,4407,4408,4409,4410,4411,4413,4414,4416,4417,4418,4419,4420,4421,4423,4424,4425,4426,4428,4429,4430,4431,4432,4433,4434,4435,4436,4437,4438,4439,4440,4442,4443,4444,4445,4446,4447,4448,4449,4451,4452,4453,4454,4455,4456,4457,4458,4459,4460,4461,4462,4463,4464,4465,4466,4468,4472,4475,4476,4477,4478,4479,4480,4481,4482,4483,4484,4485,4486,4487,4488,4489,4490,4491,4492,4498,4500,4506,4507,4508,4509,4510,4512,4513,4516,4517,4522,4534,4535,4540,4541,4542,4543,4545,4546,4548,4549,4550,4552,4553,4554,4555,4556,4559,4560,4561,4562,4563,4564,4565,4566,4567,4568,4569,4570,4571,4572,4574,4575,4576,4577,4578,4579,4580,4581,4585,4586,4587,4588,4589,4590,4591,4592,4593,4594,4595,4596,4597,4598,4599];
const franchiseIds = [3,107,105,106,104,103,102,1062,1132,1117,1136,1128,1131,1119,1129,1106,1097,1143,1124,1150,1118,1125,1238,1115,1231,1240,1219,1255,1211,1207,1120,1098,1110,237,226,1174,1193,229,1225,1171,1233,314,370,322,302,372,326,378,377,1206,238,274,337,262,241,303,259,368,283,316,265,240,1160,354,1169,253,1256,1266,1192,1162,1185,1201,1250,374,1159,225,364,1245,371,353,345,356,319,359,383,312,294,291,233,331,264,271,236,1241,1235,290,1258,281,315,1212,1261,1173,246,1259,1228,1168,1092,1199,1204,1093,1246,1179,260,334,232,351,235,277,1172,1210,1198,1269,327,1164,1188,384,344,341,289,1203,336,279,297,1177,338,347,349,350,321,369,342,332,293,328,298,324,373,304,318,343,267,286,280,266,1091,287,1163,250,244,243,252,1244,255,1243,1236,1230,1229,1224,1234,1221,1202,1175,1166,1165,239,1197,1178,1220,362,1183,339,379,1170,335,330,1186,380,320,1223,306,313,346,269,340,251,273,231,284,230,263,1265,1260,228,224,1268,1264,1267,223,1239,1232,1254,222,227,1218,1209,1205,1208,1217,1196,1190,1187,1182,1181,1189,1213,1194,376,1167,363,299,381,305,292,258,296,375,257,256,282,308,249,1215,1249,1200,1251,348,278,361,1158,234,323,1248,254,357,1094,358,1176,325,355,247,1180,1253,1195,242,301,276,275,272,270,261,245,248,365,268,1263,1262,285,1252,1257,1247,1226,1237,1227,1161,1222,1184,1214,1242,360,366,1216,317,333,1191,311,329,310,307,367,295,300,309,382,352,288,1085,1084,1083,1090,162,1089,1087,1086,1088,183,182,202,1108,1145,1114,1130,1148,1107,1103,1137,1135,1116,1100,1142,1127,1099,1101,1121,1109,1111,1102,1144,1138,1141,1104,1140,1153,1122,1095,1154,1133,1123,1105,1134,1152,1113,1149,1155,1151,1146,1126,1112,1147,1096,1139,1271,1272,1273,1157,1288,1274,1277,1279,1275,1280,1283,1281,1287,1286,1278,1285,1276,1282,1094,1292,1293,1297,1290,1296,362,1295,1294,1272,319,385,1301,1289,1299,386,1298];

// Geo Obscure Filter Types
const countryRestrictionId = countryRestrictionIdList.slice();
const geoChannelSegmentationId  = channelSegmentationIdList.slice();
const geoMarketingInitiativeId = marketingInitiativeIdList.slice();
const geoMerchForecastQuantity = merchForecastQuantityList.slice();
const gmoStatus = [0, 1];
const gpoStatus = [0, 1];

// Country Obscure Filter Types
const cmoStatus = [0, 1];
const countryChannelSegmentationId = channelSegmentationIdList.slice();
const countryMarketingInitiativeId = marketingInitiativeIdList.slice();
const countryMerchForecastQuantity = merchForecastQuantityList.slice();
const cpoStatus = [0, 1];

// Country List
const countryObscureList = {accountCode, businessOrganizationCode, carryOver, cmoStatus, consumerFocusId, consumerPurposeCode, consumerGroupCode, countryChannelSegmentationId,
	countryMarketingInitiativeId, countryMerchForecastQuantity,
	cpoStatus};

// Geo List
const geoObscureList = {accountCode, businessOrganizationCode, carryOver, consumerFocusId,
	consumerPurposeCode, consumerGroupCode, countryRestrictionId, geoChannelSegmentationId,
	geoMarketingInitiativeId, geoMerchForecastQuantity, gmoStatus,
	gpoStatus};

// Global List
const globalObscureList = {accountCode, alwaysAvailable, businessOrganizationCode, carryOver,
	categoryPlm, categorySummaryCode, channelSegmentationId, consumerFocusId,
	consumerGroupId: consumerGroupCode, consumerPurposeId: consumerPurposeCode,
	developmentTeamId, fitCode, geoRestrictionId, marketingInitiativeId, initiatorId,
	leagueId, marketingName, modelGroupId, modelGroupTypeId, modelId, modelName, moStatus,
	productCategoryCode, productId, productSubCategoryCode, silhouetteCode, siloId,
	sportActivityCode, sportLevelId, styleNumber, teamId, tierId};

const listsByLevel = {1: globalObscureList, 2: geoObscureList, 3: countryObscureList};

export const getRandomWeightedRegion = () => {
	return randomItemWeightedArray(
		{ weight: 40, array: regions.global },
		{ weight: 30, array: regions.geography },
		{ weight: 30, array: regions.country }
	);
};

export const getRandomFilters = (optimal = false, additionalFilters = false, obscureFiltersPercent = 10, levelId = 1) => {
	const responseObj = {};
	const filtersObj = {};
	let queryDescriptor = '';

	if(optimal){
		filtersObj.ageCode = randomItem(ageCodes);
		filtersObj.coreFocusCode = randomItem(coreFocusCodes);
		filtersObj.genderCode = randomItem(genderCodes);
		filtersObj.divisionCode = randomItem(divisionCodes);
	}
	else {
		// Use Division Code 94% of the time
		if(randomInt(0,100) < 94) {
			filtersObj.divisionCode = randomItems(divisionCodes, 0, 2);
		}

		// Use Core Focus Code 94% of the time
		if(randomInt(0,100) < 94) {
			filtersObj.coreFocusCode = randomItems(coreFocusCodes, 0, 6);
		}

		// Use Gender Code 81% of the time
		if(randomInt(0,100) < 81) {
			filtersObj.genderCode = randomItems(genderCodes, 0);
		}

		// Use Age Code 80% of the time
		if(randomInt(0,100) < 80) {
			filtersObj.ageCode = randomItems(ageCodes, 0, 3);
		}

    if(filtersObj.ageCode.length + filtersObj.coreFocusCode.length + filtersObj.genderCode.length + filtersObj.divisionCode.length > 0 ){
		  queryDescriptor += 'Indexed';
	  }
	  else {
		  queryDescriptor += 'Unindexed';
	  }
	}

	if(additionalFilters){

		// Add merchClassificationId 5% of the time
		if(filtersObj.divisionCode && randomInt(0, 100) < 5) {
			// Add AP merch class if AP
			if(filtersObj.divisionCode.includes('10')) {
				filtersObj.merchClassificationId = randomItems(merchlassificationAPIds, 1);
			}

			// Add EQ merch class if EQ
			if (filtersObj.divisionCode.includes('30')) {
				filtersObj.merchClassificationId = randomItems(merchlassificationEQIds, 1);
			}
		}

		// Add Platform param if FW
		if (filtersObj.divisionCode && filtersObj.divisionCode.includes('20')){

			// 5% of the time add a platform parameter
			if(randomInt(0, 100) < 5) {
				filtersObj.platformId = randomItems(platformCodes, 1);
			}
		}

		// 20% of the time add a fitCode parameter
		// I don't see fitCode as a filter option
		/*if(randomInt(0, 100) < 20){
			filtersObj.fitCode = randomItem(['AF', 'WF']);
		}*/

		// 5% of the time add a collection parameter
		if(randomInt(0, 100) < 5){
			filtersObj.collectionId = randomItems(collectionIds, 1, 5);
		}

		// 5% of the time add a franchise parameter
		if(randomInt(0, 100) < 5){
			filtersObj.franchiseId = randomItems(franchiseIds, 1, 3);
		}

		// 40% of the time add a marketingTypeCode parameter
		if(randomInt(0, 100) < 40){
			let filterName;

			switch(levelId){
				case 1:
					filterName = 'marketingTypeId';
					break;
				case 2:
					filterName = 'geoMarketingTypeId';
					break;
				case 3:
					filterName = 'countryMarketingTypeId';
					break;
				default:
					break;
			}

			filtersObj[filterName] = randomItems(marketingTypeCodes, 1);
		}
	}

	if(randomInt(0, 100) < obscureFiltersPercent) {
		queryDescriptor += 'Obscure';
		assignObscureFilterType(filtersObj, listsByLevel[levelId]);
	}

	responseObj.filtersObj = filtersObj;
	responseObj.queryDescriptor = queryDescriptor;

	return responseObj;
};

const assignObscureFilterType = (filtersObj, filterTypeList) => {
	const randomFilterType = randomItem(Object.keys(filterTypeList));
	const randomValues = isSingleFilterType(randomFilterType) ?
		randomItem(filterTypeList[randomFilterType]) :
		randomItems(filterTypeList[randomFilterType], 1);

	filtersObj[randomFilterType] = randomValues;
};

const isSingleFilterType = (searchString) => {
	searchString = searchString.toLowerCase();

	return searchString.includes('status') || searchString.includes('carryover') ||
	searchString.includes('merchforecast') || searchString.includes('alwaysavailable') ||
	searchString.includes('name');
};

export const generateBaseExportQuery = (seasonCodes) => {
	const query = {};
	const filtersObj = getRandomFilters();

	const filters = {};

	if(filtersObj.divisionCode.length){
		filters.division = filtersObj.divisionCode;
	}

	if(filtersObj.ageCode.length){
		filters.age = filtersObj.ageCode;
	}

	if(filtersObj.genderCode.length){
		filters.gender = filtersObj.genderCode;
	}

	if(filtersObj.coreFocusCode.length){
		filters.coreFocus = filtersObj.coreFocusCode;
	}

	query.fileName = randomCharacters(15);
	query.regionId = getRandomWeightedRegion();
	query.seasonCode = randomItem(seasonCodes);
	query.sorting = [];
	query.filters = filters;
	query.pageSize = {
		'width': 1200,
		'height': 800
	};

	return query;
};

export const generateBasePlaceholderPost = () => {
	const query = {};

	// Required fields
	query.name = randomCharacters(15);
	query.divisionCode = randomItem(divisionCodes);
	query.genderCode = randomItem(genderCodes);
	query.silhouetteCode = randomItem(silhouetteCodesByDiv[query.divisionCode]);

	// Optional Fields
	query.description = randomCharacters(20);
	query.coreFocusCode = randomItem(coreFocusCodes);
	query.ageCode = randomItem(agesByDiv[query.divisionCode]);
	query.retail = randomInt(1, 100).toString();
	query.wholesale = 0; // not used in UI yet
	query.offerDate = ''; // not used in UI yet

	return query;
};

export const generateQuery = (optimal = false, additionalFilters = false, obscureFiltersPercent = 0, levelId = 1) => {
	const queryObj = getRandomFilters(optimal, additionalFilters, obscureFiltersPercent, levelId);
	const filtersObj = queryObj.filtersObj;
	const responseObj = {};

	responseObj.queryDescriptor = queryObj.queryDescriptor;

	const where = {};

	Object.keys(filtersObj).forEach((key) => {
		if(filtersObj[key].length || typeof filtersObj[key] === 'number'){
			if(Array.isArray(filtersObj[key])){
				where[key] = {in: filtersObj[key]};
			}
			else if(key.toLowerCase().includes('name')){
				where[key] = {like: filtersObj[key]};
			}
			else {
				where[key] = {eq: filtersObj[key]};
			}
		}
	});

	responseObj.where = where;

	return responseObj;
};
