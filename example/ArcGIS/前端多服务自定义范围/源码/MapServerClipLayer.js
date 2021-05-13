// 自定义范围 动态图层
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
  "esri/core/accessorSupport/decorators",
  "esri/layers/BaseDynamicLayer",
  "esri/request",
], function (decorators, BaseDynamicLayer, esriRequest) {
  // "use strict";
  return (function (_super) {
    function MapServerClipLayer() {
      var _self = _super.call(this) || this;
      return _self;
    }
    __extends(MapServerClipLayer, _super);

    MapServerClipLayer.prototype.getImageUrl = function (
      extent,
      width,
      height
    ) {
      //extent 视图的范围。该值由LayerView填充。
      //width  视图的宽度（以像素为单位）。该值由LayerView填充。
      //height 视图的高度（以像素为单位）。该值由LayerView填充。
      let url = "";
   if(this.url){
    if (this.layerid) {
      url =
        this.url +
        "/export?bbox=" +
        `${extent.xmin},${extent.ymin},${extent.xmax},${extent.ymax}` +
        "&bboxSR=" +
        `${extent.spatialReference.wkid}` +
        "&imageSR=" +
        `${extent.spatialReference.wkid}` +
        `&size=${width},${height}` +
        "&dpi=96&format=png32&transparent=true&layers=show%3A" +
        `${this.layerid}` +
        "&f=image";
    } else {
      url =
        this.url +
        "/export?bbox=" +
        `${extent.xmin},${extent.ymin},${extent.xmax},${extent.ymax}` +
        "&bboxSR=" +
        `${extent.spatialReference.wkid}` +
        "&imageSR=" +
        `${extent.spatialReference.wkid}` +
        `&size=${width},${height}` +
        "&dpi=96&format=png32&transparent=true&f=image";
    }
    if (this.geometry) {
      // 左上角
      var lefttop = {
        x: this.geometry.extent.xmin,
        y: this.geometry.extent.ymax,
        spatialReference: this.geometry.extent.spatialReference,
      };
    if(this.view){
      var screen_lefttop = this.view.toScreen(lefttop);
      // 右下角
      var rightbottom = {
        x: this.geometry.extent.xmax,
        y: this.geometry.extent.ymin,
        spatialReference: this.geometry.extent.spatialReference,
      };
      var screen_rightbottom = this.view.toScreen(rightbottom);
      var stretchWidth = screen_rightbottom.x - screen_lefttop.x; //当前绘制图形的宽
      var stretchHeight = screen_rightbottom.y - screen_lefttop.y; //当前绘制图形的长
      let zuobiao = topm(
        this.geometry,
        this.geometry.extent.spatialReference,
        this.view
      );
      //geometry转换屏幕多边形坐标
      return esriRequest(url, {
        responseType: "image",
        allowImageDataAccess: true,
      }).then(
        function (response) {
          var image = response.data;
          var canvas = document.createElement("canvas");
          var context = canvas.getContext("2d");
          canvas.width = width;
          canvas.height = height;
          //绘制裁切图形
          if (this.geometry.type == "extent") {
            context.rect(
              zuobiao[0].x,
              zuobiao[0].y,
              stretchWidth,
              stretchHeight
            );
          } else {
            context.beginPath();
            for (let i = 0; i <= zuobiao.length - 1; i++) {
              if (i == zuobiao.length - 1) {
                strokeLine(context, [zuobiao[i], zuobiao[0]]);
              } else {
                strokeLine(context, [zuobiao[i], zuobiao[i + 1]]);
              }
            }
          }
          context.clip(); //裁切
          context.drawImage(image, 0, 0, width, height); //被裁切的图形
          return canvas.toDataURL("image/png");
        }.bind(this)
      );
    }else{
      console.error('view不得为空');
    }
    }else{
      console.error('geometry不得为空');
    }
   }else{
    console.error('url不得为空');

   }
    };
      //权限
    MapServerClipLayer.prototype._getToken = function () {
      if (!this.token) this.token = "";
      return this.token;
    };
    MapServerClipLayer.prototype.fetchTile = function (
      extent,
      width,
      height
    ) {};

    //地理坐标转屏幕坐标
    function topm(geometry, spatialReference, view) {
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

    //canvas 画线
    async function strokeLine(context, zuobiao) {
      context.lineTo(zuobiao[1].x, zuobiao[1].y);
    }
    return (MapServerClipLayer = __decorate(
      [decorators.subclass("    MapServerClipLayer")],
      MapServerClipLayer
    ));
  })(decorators.declared(BaseDynamicLayer));
});
