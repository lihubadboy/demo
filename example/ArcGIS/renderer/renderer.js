
// 给精模
const buildingRender = {
  type: 'simple',
  symbol: {
    type: 'mesh-3d',
    symbolLayers: [
      {
        type: 'fill',
        material: {
          color: [244, 232, 206],
          colorMixMode: 'replace',
        },
        edges: {
          type: 'solid',
          color: [244, 232, 206],
          size: 1,
        },
      },
    ],
  },
};

// 图片点
const PictureMarkerRenderer = {
  type: "simple", // autocasts as new SimpleRenderer()
  symbol: getPictureMakerSymbol("./images/icon.png", 100, 100),
},
const getPictureMakerSymbol = (url, width, height) => {
  return {
    symbol: {
      type: "picture-marker",  // autocasts as new PictureMarkerSymbol()
      url: url,
      width: width,
      height: height
    },
  }
}

//  给要素添加三维符号的时候
//  如果要素文字符号化 不随屏幕大小调整  featurelayer.screenSizePerspectiveEnabled = false;
//  如果要素服务symbol 随视角变化 需要将要素拔高
const layer = {
  elevationInfo: {
    mode: 'absolute-height',
    offset: 12,
    unit: 'meters'
  },
  renderer: PicturePointRenderer,
  labelingInfo: getPicturePointLabelingInfo
}


const getPicturePointLabelingInfo = (attr) => {
  return (
    [
      {
        labelExpressionInfo: {
          expression: `Left($feature[${attr}], 8)`, // 可控制显示几个字符
        },
        labelPlacement: 'center-center',
        symbol: {
          type: 'label-3d', // autocasts as new LabelSymbol3D()
          symbolLayers: [
            {
              type: 'text', // autocasts as new TextSymbol3DLayer()
              material: {
                color: 'white',
              },
              size: 10,
            },
          ],
        },
      },
    ]
  )
};
const PicturePointRenderer = {
  type: "simple",
  symbol: getPointSymbol3D("./images/icon.png", "white", 126)
}

const getPointSymbol3D = (url, color, size = 38) => {
  return {
    type: 'point-3d', // autocasts as new PointSymbol3D()
    symbolLayers: [
      {
        type: 'icon', // autocasts as new IconSymbol3DLayer()
        resource: {
          href: url,
        },
        size: size,
        outline: {
          color: color ? color : 'white',
          size: 2,
        },
        anchor: "relative",
        anchorPosition: {
          x: 0,
          y: 0.5
        },
      },
    ],
  };
}
