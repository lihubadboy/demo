

/**
 * 近期发现scenelayer查询的时候提示未有关联要素图层，且用scenelayerview 只支持objectid查询
 * 原因：通过slpk发服务 不会自动发关联要素图层  应该在mutipatch阶段发布服务，有选择发布关联要素的选项
 */


// 高亮该年份的建筑
let highlight = null;
function highlightYear(value) {
    let highlight;
    view.whenLayerView(layer).then(function (layerView) {
        let query = layerView.createQuery();
        query.where = "const_time = " + '200801';
        layerView.queryFeatures(query).then(function (result) {
            if (highlight) {
                highlight.remove();
            }
            highlight = layerView.highlight(result.features);
        })
    });
}