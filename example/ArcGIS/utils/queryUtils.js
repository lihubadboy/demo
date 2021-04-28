

// 三维图层scenelayer的查询

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