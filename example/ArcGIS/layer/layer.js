
const featureLayer = {
    title: '房屋管理_销售TOP10点',
    id: 'houseManger_xiaoshoupoint',
    type: 'feature',
    visible: true,
    url:
        'https://wisehost01.smart-center.com/server/rest/services/%E7%94%9F%E6%80%81%E5%9F%8E%E5%B0%8F%E5%8C%BATop10/MapServer/1',
    elevationInfo: {
        mode: 'absolute-height',
        offset: 12,
        unit: 'meters'
    },
    labelingInfo: labelingInfo_houseIcon,
    renderer: {
        type: 'simple',
        symbol: getUniqueValueSymbol('./images/房屋-广告牌.svg', '#13C2C2', 110),
    },
    screenSizePerspectiveEnabled: false, // 图片大小不随缩放放大缩小
    outFields: ['*'],
    popupEnabled: false,
}

const sceneLayer = {
    title: '房屋管理_已入住未入住',
    id: 'houseManger_live',
    type: 'scene',
    visible: true,
    url:
        'https://wisehost01.smart-center.com/server/rest/services/Hosted/%E5%B7%B2%E5%85%A5%E4%BD%8F%E6%9C%AA%E5%85%A5%E4%BD%8F_SceneService/SceneServer',
    elevationInfo: {
        mode: 'on-the-ground',
    },
    outFields: ['*'],
    popupEnabled: false,
},


