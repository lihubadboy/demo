//自定义范围 动态切片影像图层
var __extends =
  (this && this.__extends) ||
  (function () {
    var extendStatics =
      Object.setPrototypeOf ||
      ({
        __proto__: [],
      } instanceof Array &&
        function (d, b) {
          d.__proto__ = b;
        }) ||
      function (d, b) {
        for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
      };
    return function (d, b) {
      extendStatics(d, b);

      function __() {
        this.constructor = d;
      }
      d.prototype =
        b === null
          ? Object.create(b)
          : ((__.prototype = b.prototype), new __());
    };
  })();

var __decorate =
  (this && this.__decorate) ||
  function (decorators, target, key, desc) {
    var c = arguments.length,
      r =
        c < 3
          ? target
          : desc === null
          ? (desc = Object.getOwnPropertyDescriptor(target, key))
          : desc,
      d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
      r = Reflect.decorate(decorators, target, key, desc);
    else
      for (var i = decorators.length - 1; i >= 0; i--)
        if ((d = decorators[i]))
          r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
  };

define([
  // "esri/core/tsSupport/declareExtendsHelper",
  // "esri/core/tsSupport/decorateHelper",
  "esri/core/accessorSupport/decorators",
  "esri/layers/BaseTileLayer",
  "esri/request",
  "esri/geometry/Extent",
  "esri/geometry/geometryEngine",
], function (
  decorators,
  BaseTileLayer,
  esriRequest,
  Extent,
  geometryEngine,
) {
  // "use strict";
  return (function (_super) {
    function TileClipImageryLayer() {
      var _self = _super.call(this) || this;
      return _self;
    }
    __extends(TileClipImageryLayer, _super);

    TileClipImageryLayer.prototype._getTileUrl = function (level, row, col) {
      var lt_x =
        this.tileInfo.origin.x +
        col * this.tileInfo.lods[level].resolution * this.tileInfo.size[0];
      var lt_y =
        this.tileInfo.origin.y -
        row * this.tileInfo.lods[level].resolution * this.tileInfo.size[1];
      var rb_x =
        this.tileInfo.origin.x +
        (col + 1) *
          this.tileInfo.lods[level].resolution *
          this.tileInfo.size[0];
      var rb_y =
        this.tileInfo.origin.y -
        (row + 1) *
          this.tileInfo.lods[level].resolution *
          this.tileInfo.size[1];
      var bbox = lt_x + "," + rb_y + "," + rb_x + "," + lt_y;
      var content = {
        bbox: bbox,
        size: this.tileInfo.size[0] + "," + this.tileInfo.size[1],
        token: this._getToken(),
        dpi: this.tileInfo["dpi"],
        format: this.tileInfo["format"],
        transparent: true,
        f: "image",
      };
      return content;
    };
    //各图层定义
    TileClipImageryLayer.prototype._getLayerDefs = function (sublayers) {
      var layerDefs = {};
      sublayers.map(function (sublayer) {
        layerDefs[sublayer.id] = sublayer.definitionExpression;
      });
      return JSON.stringify(layerDefs);
    };
    //权限
    TileClipImageryLayer.prototype._getToken = function () {
      if (!this.token) this.token = "";
      return this.token;
    };

    TileClipImageryLayer.prototype.fetchTile = function (level, row, col) {
      var content = this._getTileUrl(level, row, col);
      if (this.url) {
        return esriRequest(this.url + "/exportImage?f=image", {
          responseType: "image",
          query: content,
          allowImageDataAccess: true,
        }).then(
          function (response) {
            var image = response.data;
            var width = this.tileInfo.size[0];
            var height = this.tileInfo.size[0];
            var canvas = document.createElement("canvas");
            var context = canvas.getContext("2d");
            canvas.width = width;
            canvas.height = height;
            var lt_x =
              this.tileInfo.origin.x +
              col *
                this.tileInfo.lods[level].resolution *
                this.tileInfo.size[0];
            var lt_y =
              this.tileInfo.origin.y -
              row *
                this.tileInfo.lods[level].resolution *
                this.tileInfo.size[1];
            var rb_x =
              this.tileInfo.origin.x +
              (col + 1) *
                this.tileInfo.lods[level].resolution *
                this.tileInfo.size[0];
            var rb_y =
              this.tileInfo.origin.y -
              (row + 1) *
                this.tileInfo.lods[level].resolution *
                this.tileInfo.size[1];
            if (this.geometry) {
              let extentImg = new Extent({
                xmin: lt_x,
                ymin: rb_y,
                xmax: rb_x,
                ymax: lt_y,
                spatialReference: this.geometry.extent.spatialReference,
              });
              if (this.view) {
                let a = geometryEngine.intersects(extentImg, this.geometry);
                if (a) {
                  let cliped = geometryEngine.intersect(
                    extentImg,
                    this.geometry
                  );
                  let zuobiaocliped = topm(
                    cliped,
                    cliped.spatialReference,
                    this.view
                  );
                  let zuobiaoextentImg = topm(
                    extentImg,
                    extentImg.spatialReference,
                    this.view
                  );
                  //绘制裁切图形
                  if (this.geometry.type == "extent") {
                    let leftx = Math.abs(
                      zuobiaocliped[0].x - zuobiaoextentImg[0].x
                    );
                    let lefty = Math.abs(
                      zuobiaocliped[0].y - zuobiaoextentImg[0].y
                    );

                    let zuizhongwidth =
                      (cliped.extent.xmax - cliped.extent.xmin) /
                      this.tileInfo.lods[level].resolution;
                    let zuizhongheight =
                      (cliped.extent.ymax - cliped.extent.ymin) /
                      this.tileInfo.lods[level].resolution;
                    context.rect(leftx, lefty, zuizhongwidth, zuizhongheight);
                  } else {
                    context.beginPath();
                    for (let i = 0; i <= zuobiaocliped.length - 1; i++) {
                      context.lineTo(
                        zuobiaocliped[i].x - zuobiaoextentImg[0].x,
                        zuobiaocliped[i].y - zuobiaoextentImg[0].y
                      );
                    }
                  }
                  context.clip(); //裁切
                  context.drawImage(image, 0, 0, width, height);
                }
                return canvas;
              } else {
                console.error("view不能为空");
              }
            } else {
              console.error("geometry不能为空");
            }
          }.bind(this)
        );
      } else {
        console.error("url不能为空");
      }
    };
    //地理坐标转屏幕坐标
    function topm(geometry, spatialReference, view) {
      // view = this.view
      let zuobiao = [];
      if (geometry.type == "extent") {
        // 左上角
        var lefttop = {
          x: geometry.xmin,
          y: geometry.ymax,
          spatialReference: spatialReference,
        };
        var screen_lefttop = view.toScreen(lefttop);

        // 右下角
        var rightbottom = {
          x: geometry.xmax,
          y: geometry.ymin,
          spatialReference: spatialReference,
        };
        var screen_rightbottom = view.toScreen(rightbottom);

        var stretchWidth = screen_rightbottom.x - screen_lefttop.x;
        var stretchHeight = screen_rightbottom.y - screen_lefttop.y;
        zuobiao = [screen_lefttop, stretchWidth, stretchHeight];
      } else {
        geometry.rings[0].forEach((element) => {
          var lefttop_raster = {
            x: element[0],
            y: element[1],
            spatialReference: spatialReference,
          };
          zuobiao.push(view.toScreen(lefttop_raster));
        });
      }
      return zuobiao;
    }

    return (TileClipImageryLayer = __decorate(
      [decorators.subclass("TileClipImageryLayer")],
      TileClipImageryLayer
    ));
  })(decorators.declared(BaseTileLayer));
});
