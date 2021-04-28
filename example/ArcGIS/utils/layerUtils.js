import jsapi from '../jsapi';
import viewUtils from './viewUtils';
/**
 * 根据图层的title获取图层
 * @author  lee
 * @param {object} view  场景
 * @param {string} title  名称
 */
function getLayerByTitle(title) {
    const view = await viewUtils.isViewReady();
    const foundLayer = view.map.layers.find(lyr => {
        return lyr.title === title;
    });
    return foundLayer;
}
