const vscode = require('vscode');

exports.activate = function (context) {
    vscode.commands.registerCommand('extension.bbbug', function () {
        bbbug.init();
    });
};
exports.deactivate = function () {
};
let bbbug = {
    data: {
        postBase: {
            access_token: "",
            version: 10000,
            plat: "vscode",
        },
        userInfo:false,
        form: {
            login: {
                user_account: "",
                user_password: ""
            }
        }
    },
    init() {
        let that = this;
        vscode.window.showQuickPick(
            [
                "发送消息",
                "我要点歌",
                "切歌&不喜欢",
                "房间列表",
                "在线用户",
            ],
            {
                placeHolder: '欢迎来到BBBUG.COM音乐聊天室'
            })
            .then(function (msg) {
                switch (msg) {
                    case '发送消息':
                        that.sendMessage();
                        break;
                    default:
                        console.log(msg);
                        if (msg != undefined) {
                            // vscode.window.setStatusBarMessage('We will comming soon...',3000);
                            vscode.window.showInformationMessage('We will comming soon...', {
                                modal: true
                            });
                            that.init();
                        }
                    // vscode.window.setStatusBarMessage('今天也要快乐鸭！~',3000);
                    // vscode.window.showInformationMessage('今天也要快乐鸭！',{
                    //     modal:true
                    // });vscode.window.showInformationMessage("请问你现在的心情如何",'你说什么','我不知道','再见！')
                    // .then(function(select){
                    //     console.log(select);
                    // });
                }
            });
    },
    sendMessage() {
        let that = this;
        vscode.window.showInputBox(
            {
                password: false, // 输入内容是否是密码
                ignoreFocusOut: false, // 默认false，设置为true时鼠标点击别的地方输入框不会消失
                placeHolder: '说点什么吧...', // 在输入框内的提示信息
                prompt: '', // 在输入框下方的提示信息
                // validateInput: function (text) {
                //     return text;
                // }
            }).then(function (msg) {
                if (msg == undefined) {
                    that.init();
                } else {
                    vscode.window.showErrorMessage(msg, 3000);
                }
            });
    }
};