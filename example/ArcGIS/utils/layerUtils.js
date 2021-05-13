import jsapi from '../jsapi';
import viewUtils from './viewUtils';
/**
 * 根据图层的title获取图层
 */
function getLayerByTitle(view, title) {
    const foundLayer = view.map.layers.find(lyr => {
        return lyr.title === title;
    });
    return foundLayer;
}
/**
 * 设置图层显示隐藏
 */
function setLayerVisible(view, title, visible) {
    const foundLayer = getLayerByTitle(view, title);
    if (foundLayer) {
        foundLayer.visible = visible;
    }
}


// 通过某些属性控制图层显示哪些要素
const definitonFeatures = async (layer, ids, key) => {
    const params = ids.map((id) => `'${id}'`);
    layer.definitionExpression = key + ` in (${params})`;
};
// 还原原状态
const recoveryFeatures = (layer) => {
    layer.definitionExpression = '';
}