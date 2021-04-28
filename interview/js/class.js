// 构造函数
function Person(name){
    this.name= name;
    this.hobby = function(){
        return 'swimming';
    }
}
const boy = new Person();
// 构造函数的特点
// 1、构造函数首字母需要大写
// 2、this代指实例对象的
// 3、new 调用构造函数 返回对象实例

缺点
构造函数的实例对象无法共享属性和方法

function Person(name,sex){
    this.name = name;
    this.sex = sex;
}
Person.prototype.say = function(){
    console.log('nihao');
}


const boy = new Person();
const girl = new Person();
boy.say === girl.say



