
var layer = new MapImageLayer({
    url: "https://sampleserver6.arcgisonline.com/arcgis/rest/services/USA/MapServer",
    sublayers: [
      {
        id: 3,
        visible: false
      },
      {
        id: 2,
        visible: true
      },
      {
        id: 1,
        visible: true
      },
      {
        id: 0,
        visible: true,
        definitionExpression: "pop2000 > 100000"
      }
    ]
  });