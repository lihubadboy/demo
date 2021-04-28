import jsapi from '../jsapi';

let viewCache = {};
/**
 * 判断当前view是否准备好
 * @author  lwei
 * @param
 * @returns {object}  promise
 */
export function isViewReady(getViewFn = () => window.ags.view) {
    let timer;
    let _fnStr = '' + getViewFn; // 用于对比函数内容

    // 读取缓存
    if (viewCache[_fnStr]) {
        return viewCache[_fnStr];
    }

    // 包裹错误
    let _getViewFn = () => {
        try {
            return getViewFn();
        } catch (error) {
            return null;
        }
    };

    // view已经加载可以直接获取
    if (_getViewFn()) {
        return new Promise(resolve => resolve(_getViewFn()));
    }

    //  view还在加载时
    viewCache[_fnStr] = new Promise(reslove => {
        timer = setInterval(() => {
            if (_getViewFn()) {
                clearInterval(timer);
                reslove(_getViewFn());
            }
        }, 300);
    });

    return viewCache[_fnStr];
}
/**
 * 判断
 * @author  lhu
 * @param
 * @returns {object} 
 */
const goToCamera = (cameraJson) => {
    const view = await isViewReady();
    const [Camera] = await jsapi.load(['esri/Camera']);
    const cam = new Camera(cameraJson);
    view.goTo(cam);
};



const viewUtils = {
    isViewReady,
    goToCamera,
};

export default viewUtils;
