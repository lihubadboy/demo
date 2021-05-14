

view.on("pointer-move", function (event) {
    var query = featureLayer.createQuery();
    query.geometry = view.toMap(event);  // the point location of the pointer
    query.distance = 2;
    query.units = "miles";
    query.spatialRelationship = "intersects";  // this is the default
    query.returnGeometry = true;
    query.outFields = ["POPULATION"];

    featureLayerView.queryFeatures(query)
        .then(function (response) {
            // returns a feature set with features containing the
            // POPULATION attribute and each feature's geometry
        });
});

// 高亮scenelayer  注意 query的返回字段为*
let highlight = null;
function highlightYear(value) {
    // let highlight;
    view.whenLayerView(layer).then(function (layerView) {
        let query = layer.createQuery();
        query.where = "const_time = '" + value + "'";
        query.outFields = ['*'];
        query.returnGeometry = false;

        layer.queryFeatures(query).then(function (result) {
            if (highlight) {
                highlight.remove();
                highlight = null;
            }
            highlight = layerView.highlight(result.features);
        })
    });
}

layer.definitionExpression = "mag >= 5";
layer.definitionExpression = "Sci_Name = 'Ulmus pumila'"
layer.definitionExpression = "HEIGHT > 50";
layer.definitionExpression = "usage = 'Residential' AND totalHeight < 5"