const vscode = require('vscode');
const axios = require('axios');
const { resolve } = require('path')
const fs = require('fs')

let WebSocketClient = require('websocket').client;//获取websocketclient模块
let roomBar, musicBar, onlineBar, userBar, playerPanel, msgBar;
let msgList = [];
exports.activate = function (context) {
    vscode.commands.registerCommand('extension.bbbug', function () {
        vscode.window.showQuickPick(
            [
                "我要聊天",
                "我要点歌",
                "当前歌单",
                "我的歌单",
                (bbbug.data.userInfo && bbbug.data.userInfo.user_admin) || (bbbug.data.roomInfo && bbbug.data.roomInfo.room_user == bbbug.data.userInfo.user_id) || (bbbug.data.songInfo && bbbug.data.songInfo.user.user_id == bbbug.data.userInfo.user_id) ? "切掉这首歌" : "不喜欢这首歌",
                "切换房间",
                "在线用户",
                "重启播放器",
                "退出登录",
            ],
            {
                placeHolder: 'BBBUG.COM快捷指令'
            })
            .then(function (msg) {
                if (msg != undefined) {
                    switch (msg) {
                        case '我要聊天':
                            bbbug.sendMessage();
                            break;
                        case '我要点歌':
                            bbbug.searchSong();
                            break;
                        case '当前歌单':
                            bbbug.showPickedSongList();
                            break;
                        case '我的歌单':
                            bbbug.showMySongList();
                            break;
                        case '切掉这首歌':
                        case '不喜欢这首歌':
                            bbbug.passSong();
                            break;
                        case '切换房间':
                            bbbug.showRoomList();
                            break;
                        case '在线用户':
                            vscode.commands.executeCommand('extension.bbbug.user.online');
                            break;
                        case '重启播放器':
                            bbbug.initAudioPanel();
                            bbbug.websocket.connection.send("getNowSong");
                        case '退出登录':
                            bbbug.logout();
                            break;
                        default:
                            bbbug.showError(msg + "即将上线，敬请期待");
                    }
                }
            });
    });
    bbbug.initAudioPanel();
    bbbug.websocket.client = new WebSocketClient();//创建客户端对象
    //连接失败执行
    bbbug.websocket.client.on('connectFailed',
        function (error) {
            bbbug.websocket.isConnected = false;
            setTimeout(function () {
                bbbug.reConnectWebsocket();
            }, 1000);
        }
    );

    bbbug.websocket.client.on('connect', function (connection) {
        bbbug.websocket.forceStop = false;
        bbbug.websocketHeartBeat();
        //连接错误抛出
        bbbug.websocket.isConnected = true;
        bbbug.websocket.connection = connection;
        connection.on('error', function (error) {
            bbbug.websocket.isConnected = false;

        });
        //连接关闭执行
        connection.on('close', function () {
            bbbug.websocket.isConnected = false;
            clearTimeout(bbbug.websocket.heartBeatTimer);
            if (!bbbug.websocket.forceStop) {
                setTimeout(function () {
                    bbbug.reConnectWebsocket();
                }, 1000);
            }
        });
        //收到服务器的返回消息
        connection.on('message', function (message) {
            if (message.type === 'utf8') {
                bbbug.messageController(message.utf8Data);
            }
        });
    });

    roomBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    roomBar.text = '$(bug) 点击这里登录';
    roomBar.color = "#fff";
    roomBar.command = "extension.bbbug.room.menu";
    roomBar.show();

    onlineBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    onlineBar.text = '$(smiley) 在线0';
    onlineBar.color = "#aaa";
    onlineBar.command = "extension.bbbug.user.online";
    onlineBar.show();

    musicBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    musicBar.text = '$(clock) 加载中...';
    musicBar.color = "#fff";
    musicBar.command = "extension.bbbug.song.menu";
    musicBar.show();

    userBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    userBar.text = '游客，请登录';
    userBar.color = "#fff";
    userBar.command = "extension.bbbug.user.menu";
    userBar.show();

    msgBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
    msgBar.text = '消息中心';
    msgBar.color = "#fff";
    msgBar.command = "extension.bbbug.msg.menu";
    msgBar.show();

    let fileName = __dirname + '/access_token.bbbug';
    let _access_token = fs.existsSync(fileName) ? fs.readFileSync(fileName) : false;
    if (_access_token) {
        bbbug.data.postBase.access_token = _access_token.toString();
        bbbug.request({
            url: "user/getmyinfo",
            success(res) {
                console.log(res);
                bbbug.data.userInfo = res.data;
                userBar.text = "已登录:" + decodeURIComponent(res.data.user_name);
                bbbug.showSuccess("登录成功!");
                bbbug.joinRoomByRoomId(888);
            }, error(res) {
                bbbug.logout();
            }
        });
    } else {
        bbbug.logout();
    }

    vscode.commands.registerCommand('extension.bbbug.song.menu', function () {
        let title = "没有歌曲啦，快去点歌吧~";
        let menuList = ["我要点歌"];
        if (bbbug.data.songInfo && bbbug.data.songInfo.song && bbbug.data.songInfo.user) {
            title = bbbug.data.songInfo.song.name + "(" + bbbug.data.songInfo.song.singer + ") 点歌人: " + decodeURIComponent(bbbug.data.songInfo.user.user_name);
            menuList = [
                "我要点歌",
                "播放列表",
                (bbbug.data.userInfo && bbbug.data.userInfo.user_admin) || (bbbug.data.roomInfo && bbbug.data.roomInfo.room_user == bbbug.data.userInfo.user_id) || (bbbug.data.songInfo && bbbug.data.songInfo.user.user_id == bbbug.data.userInfo.user_id) ? "切掉这首歌" : "不喜欢这首歌",
                "重启播放器"
            ];
        }
        vscode.window.showQuickPick(
            menuList,
            {
                placeHolder: title
            })
            .then(function (msg) {
                switch (msg) {
                    case '我要点歌':
                        if (!bbbug.data.userInfo || bbbug.data.userInfo.user_id <= 0) {
                            vscode.commands.executeCommand('extension.bbbug.user.login');
                            return;
                        }
                        bbbug.searchSong();
                        break;
                    case '切掉这首歌':
                    case '不喜欢这首歌':
                        bbbug.passSong();
                        break;
                    case '播放列表':
                        bbbug.showPickedSongList();
                        break;
                    case '重启播放器':
                        bbbug.initAudioPanel();
                        bbbug.websocket.connection.send("getNowSong");
                        break;
                    default:
                }
            });
    });
    vscode.commands.registerCommand('extension.bbbug.message.send', function () {
        if (!bbbug.data.userInfo || bbbug.data.userInfo.user_id <= 0) {
            vscode.commands.executeCommand('extension.bbbug.user.login');
            return;
        }
        bbbug.sendMessage();
    });
    vscode.commands.registerCommand('extension.bbbug.user.menu', function () {
        if (!bbbug.data.userInfo || bbbug.data.userInfo.user_id <= 0) {
            vscode.commands.executeCommand('extension.bbbug.user.login');
            return;
        }
        vscode.window.showQuickPick(
            [
                "我的房间",
                "我的歌单",
                "退出登录",
            ],
            {
                placeHolder: '个人中心...'
            })
            .then(function (msg) {
                if (msg != undefined) {
                    switch (msg) {
                        case '我的房间':
                            if (bbbug.data.userInfo.myRoom) {
                                bbbug.joinRoomByRoomId(bbbug.data.userInfo.myRoom.room_id);
                            } else {
                                bbbug.showError("请先去bbbug.com创建一个私有房间后再进入！");
                            }
                            break;
                        case '退出登录':
                            bbbug.logout();
                            break;
                        case '我的歌单':
                            bbbug.showMySongList();
                            break;
                        default:
                            bbbug.showError(msg + "即将上线，敬请期待");
                    }
                }
            });
    });
    vscode.commands.registerCommand('extension.bbbug.room.select', function () {
        let roomList = [];
        if (bbbug.data.userInfo.myRoom) {
            roomList.push(bbbug.data.userInfo.myRoom);
        }
        bbbug.request({
            url: "room/hotRooms",
            success(res) {
                for (let index in res.data) {
                    roomList.push(res.data[index]);
                }
                let roomNameList = [];
                for (let index in roomList) {
                    roomNameList.push({
                        label: roomList[index].room_name,
                        description: roomList[index].room_notice,
                        detail: "ID:" + roomList[index].room_id,
                    });
                }
                vscode.window.showQuickPick(
                    roomNameList,
                    {
                        placeHolder: '请选择一个房间进入'
                    })
                    .then(function (msg) {
                        if (msg != undefined) {
                            let room_id = msg.detail.replace("ID:", "");
                            bbbug.joinRoomByRoomId(room_id);
                        }
                    });
            }
        });
    });
    vscode.commands.registerCommand('extension.bbbug.msg.menu', function () {
        bbbug.updateMessageList();
        vscode.window.showQuickPick(
            msgList,
            {
                placeHolder: '消息列表'
            })
            .then(function (msg) {
                if (msg != undefined) {
                    switch (msg.description) {
                        case 'send':
                            bbbug.sendMessage();
                            break;
                        default:
                        //TODO 这里可以回复消息
                    }
                }
            });
    });
    vscode.commands.registerCommand('extension.bbbug.room.menu', function () {
        if (!bbbug.data.userInfo) {
            vscode.commands.executeCommand('extension.bbbug.user.login');
            return;
        }
        vscode.window.showQuickPick(
            [
                "聊天",
                "去大厅",
                "切换房间",
            ],
            {
                placeHolder: '你要去哪里？'
            })
            .then(function (msg) {
                switch (msg) {
                    case '切换房间':
                        vscode.commands.executeCommand('extension.bbbug.room.select');
                        break;
                    case '去大厅':
                        bbbug.joinRoomByRoomId(888);
                        break;
                    case "聊天":
                        if (!bbbug.data.userInfo || bbbug.data.userInfo.user_id <= 0) {
                            vscode.commands.executeCommand('extension.bbbug.user.login');
                            return;
                        }
                        bbbug.sendMessage();
                        break;
                    default:
                }
            });
    });
    vscode.commands.registerCommand('extension.bbbug.user.login', function () {
        if (!bbbug.data.form.login.login_type) {
            vscode.window.showQuickPick(
                [
                    "使用密码登录",
                    "使用验证码登录",
                ],
                {
                    placeHolder: '请选择登录BBBUG的方式：'
                })
                .then(function (msg) {
                    bbbug.data.form.login.user_account = false;
                    bbbug.data.form.login.user_password = false;
                    switch (msg) {
                        case '使用密码登录':
                            bbbug.data.form.login.login_type = "password";
                            vscode.commands.executeCommand('extension.bbbug.user.login');
                            break;
                        case '使用验证码登录':
                            bbbug.data.form.login.login_type = "email";
                            vscode.commands.executeCommand('extension.bbbug.user.login');
                            break;
                        default:
                    }
                });
            return;
        }
        if (!bbbug.data.form.login.user_account) {
            vscode.window.showInputBox(
                {
                    placeHolder: bbbug.data.form.login.login_type == "password" ? "请输入你的登录ID或邮箱" : "请输入你的登录邮箱",
                }).then(function (msg) {
                    if (msg == undefined) {
                        bbbug.data.form.login.login_type = false;
                        vscode.commands.executeCommand('extension.bbbug.user.login');
                    } else {
                        bbbug.data.form.login.user_account = msg;
                        if (bbbug.data.form.login.login_type == "password") {
                            vscode.commands.executeCommand('extension.bbbug.user.login');
                        } else {
                            bbbug.request({
                                url: "sms/email",
                                data: {
                                    email: msg
                                },
                                success(res) {
                                    vscode.commands.executeCommand('extension.bbbug.user.login');
                                },
                                error(res) {
                                    bbbug.showError(res.msg);
                                    vscode.commands.executeCommand('extension.bbbug.user.login');
                                }
                            });
                        }
                    }
                });
            return;
        }
        if (!bbbug.data.form.login.user_password) {
            vscode.window.showInputBox(
                {
                    password: true,
                    ignoreFocusOut: true,
                    placeHolder: bbbug.data.form.login.login_type == "password" ? "请输入你的登录密码" : "请输入你收到的验证码",
                    prompt: bbbug.data.form.login.login_type == "password" ? "" : "验证码已发送到你的邮箱,10分钟内有效"
                }).then(function (msg) {
                    if (msg == undefined) {
                        bbbug.data.form.login.login_type = false;
                        bbbug.data.form.login.user_account = false;
                        vscode.commands.executeCommand('extension.bbbug.user.login');
                    } else {
                        bbbug.data.form.login.user_password = msg;
                        bbbug.postLogin();
                    }
                });
            return;
        }
    });
    vscode.commands.registerCommand('extension.bbbug.user.online', function () {
        if (!bbbug.data.roomInfo) {
            return;
        }
        bbbug.request({
            url: "user/online",
            data: {
                room_id: bbbug.data.roomInfo.room_id
            },
            success(res) {
                console.log(res.data);
                let menuList = [];
                for (let i in res.data) {
                    menuList.push({
                        label: decodeURIComponent(res.data[i].user_name),
                        description: res.data[i].user_remark,
                        detail: "ID:" + res.data[i].user_id
                    });
                }
                vscode.window.showQuickPick(
                    menuList,
                    {
                        placeHolder: '在线用户列表'
                    })
                    .then(function (msg) {
                        if (msg == undefined) {
                            bbbug.data.message.at = false;
                        } else {
                            console.log(msg);
                            bbbug.data.message.at = {
                                user_id: msg.detail.replace("ID:", ""),
                                user_name: msg.label
                            };
                            bbbug.sendMessage();
                        }
                    });
            }
        });


    });

};

let bbbug = {
    data: {
        apiUrl: "https://api.bbbug.com/api/",
        wssUrl: false,
        postBase: {
            access_token: "ad6baeaf725cf797a2f2ef790470a4e658a67623100000ad6baeaf725cf797a2f2ef790470a4e658a67623",
            access_token: false,
            version: 10000,
            plat: "vscode",
        },
        code: {
            success: 200,
            login: 401,
            room_password_error: 302,
        },
        message: {
            success: false,
            statusTimer: false,
            hideMessageTimer: false,
            at: false,
        },
        userInfo: false,
        roomInfo: false,
        songInfo: false,
        guestUserInfo: {
            myRoom: false,
            user_admin: false,
            user_head: "images/nohead.jpg",
            user_id: -1,
            user_name: "Ghost",
            access_token: "45af3cfe44942c956e026d5fd58f0feffbd3a237",
        },
        form: {
            login: {
                login_type: false,
                user_account: false,
                user_password: false
            }
        }
    },
    websocket: {
        client: false,
        connection: false,
        isConnected: false,
        heartBeatTimer: false,
        forceStop: false,
    },
    websocketHeartBeat() {
        let that = this;
        if (that.websocket.isConnected && that.websocket.connection) {
            that.websocket.connection.send("heartBeat");
            console.log("Heart Beat...");
        }
        clearTimeout(that.websocket.heartBeatTimer);
        that.websocket.heartBeatTimer = setTimeout(function () {
            that.websocketHeartBeat();
        }, 10000);
    },
    initAudioPanel() {
        playerPanel = vscode.window.createWebviewPanel(
            'bbbug.player', // viewType
            "播放器", // 视图标题
            vscode.ViewColumn.Beside, // 显示在编辑器的哪个部位
            {
                enableScripts: true, // 启用JS，默认禁用
                retainContextWhenHidden: true, // webview被隐藏时保持状态，避免被重置
            }
        );
        playerPanel.webview.html = `
        <style>
            body,html{
                display: flex;
                align-items: center;
                justify-content: center;
                height:100%;
                outline: none;
                -webkit-text-size-adjust: none;
                -moz-text-size-adjust: none;
                -ms-text-size-adjust: none;
                text-size-adjust: none;
                -moz-user-select:none; 
                -webkit-user-select:none;
                -ms-user-select:none; 
                -khtml-user-select:none;
                user-select:none;
            }
            .info{
                text-align:center;
                text-shadow:1px 1px 1px #111;
                font-size:12px;
                color:#666;
            }
        </style>
        <div class="info">
            播放中,请勿关闭
        </div>
        <audio id="audio" src="" id="audio" autoplay="autoplay" control=""></audio>
        <script>
        const vscode = acquireVsCodeApi();
        window.addEventListener('message', function(event){
            switch(event.data.evt){
                case 'play':
                    audio.src = event.data.url;
                    audio.play();
                    break;
                default:
            }
        });
        </script>`;
    },
    logout() {
        this.data.userInfo = this.data.guestUserInfo;
        this.data.postBase.access_token = this.data.guestUserInfo.access_token;
        this.joinRoomByRoomId(888);
        userBar.text = "游客，请登录";
        this.data.form.login.login_type = false;
        this.data.form.login.user_account = false;
        this.data.form.login.user_account = false;
    },
    showSuccess(msg) {
        vscode.window.showInformationMessage(msg || "操作成功");
    },
    showError(msg) {
        vscode.window.showErrorMessage(msg || "发生一些错误，请稍候再试", {
            modal: true,
        });
    },
    passSong() {
        let that = this;
        if (!that.data.userInfo || that.data.userInfo.user_id <= 0) {
            vscode.commands.executeCommand('extension.bbbug.user.login');
            return;
        }
        if (!that.data.songInfo) {
            that.showError("当前没有播放中的歌曲");
            return;
        }
        that.request({
            url: "song/pass",
            data: {
                mid: that.data.songInfo.song.mid,
                room_id: that.data.roomInfo.room_id
            },
            success(res) {
            }
        });
    },
    showMySongList() {
        let that = this;
        if (!that.data.userInfo || that.data.userInfo.user_id <= 0) {
            vscode.commands.executeCommand('extension.bbbug.user.login');
            return;
        }
        that.request({
            url: "song/mySongList",
            data: {
                room_id: that.data.roomInfo.room_id
            },
            success(res) {
                if (res.data.length == 0) {
                    that.showError("你还没点过歌呢，快去点歌吧~");
                    return;
                }
                let songNameList = [];
                for (let i in res.data) {
                    songNameList.push({
                        label: res.data[i].name + "(" + res.data[i].singer + ")",
                        description: "点过: " + decodeURI(res.data[i].played) + "次",
                        detail: "ID:" + res.data[i].mid
                    });
                }
                vscode.window.showQuickPick(
                    songNameList,
                    {
                        placeHolder: '这是你最近点过的50首歌...'
                    })
                    .then(function (msg) {
                        if (msg != undefined) {
                            let mid = msg.detail.replace("ID:", "");
                            let menuList = [
                                "点这首歌",
                                "删除这首歌",
                            ];
                            vscode.window.showQuickPick(
                                menuList,
                                {
                                    placeHolder: msg.label + " " + msg.description
                                })
                                .then(function (msg) {
                                    switch (msg) {
                                        case '点这首歌':
                                            that.request({
                                                url: "song/addSong",
                                                data: {
                                                    mid: mid,
                                                    room_id: that.data.roomInfo.room_id
                                                },
                                                success(res) {
                                                    that.showMySongList();
                                                }
                                            });
                                            break;
                                        case '删除这首歌':
                                            that.request({
                                                url: "song/deleteMySong",
                                                data: {
                                                    mid: mid,
                                                    room_id: that.data.roomInfo.room_id
                                                },
                                                success(res) {
                                                    that.showMySongList();
                                                }
                                            });
                                            break;
                                        default:
                                    }
                                });
                        }
                    });
            }
        });
    },
    showPickedSongList() {
        let that = this;
        that.request({
            url: "song/songList",
            data: {
                room_id: that.data.roomInfo.room_id
            },
            success(res) {
                if (res.data.length == 0) {
                    that.showError("已经没有歌啦，快去点歌吧~");
                    return;
                }
                let songNameList = [];
                for (let i in res.data) {
                    songNameList.push({
                        label: res.data[i].song.name + "(" + res.data[i].song.singer + ")",
                        description: "点歌人: " + decodeURI(res.data[i].user.user_name),
                        detail: "ID:" + res.data[i].song.mid
                    });
                }
                vscode.window.showQuickPick(
                    songNameList,
                    {
                        placeHolder: '这是即将播放的歌单列表：'
                    })
                    .then(function (msg) {
                        if (msg != undefined) {
                            let mid = msg.detail.replace("ID:", "");
                            let menuList = [
                                "置顶这首歌",
                            ];
                            if ((bbbug.data.userInfo && bbbug.data.userInfo.user_admin) || (bbbug.data.roomInfo && bbbug.data.roomInfo.room_user == bbbug.data.userInfo.user_id) || (bbbug.data.songInfo && bbbug.data.songInfo.user.user_id == bbbug.data.userInfo.user_id)) {
                                menuList = [
                                    "置顶这首歌",
                                    "移除这首歌",
                                ];
                            }
                            vscode.window.showQuickPick(
                                menuList,
                                {
                                    placeHolder: msg.label + " " + msg.description
                                })
                                .then(function (msg) {
                                    switch (msg) {
                                        case '置顶这首歌':
                                            that.request({
                                                url: "song/push",
                                                data: {
                                                    mid: mid,
                                                    room_id: that.data.roomInfo.room_id
                                                },
                                                success(res) {
                                                    that.showPickedSongList();
                                                }
                                            });
                                            break;
                                        case '移除这首歌':
                                            that.request({
                                                url: "song/remove",
                                                data: {
                                                    mid: mid,
                                                    room_id: that.data.roomInfo.room_id
                                                },
                                                success(res) {
                                                    that.showPickedSongList();
                                                }
                                            });
                                            break;
                                        default:
                                    }
                                });
                        }
                    });
            }
        });
    },
    searchSong() {
        let that = this;
        vscode.window.showInputBox(
            {
                placeHolder: '输入歌名/歌手/专辑搜索...',
            }).then(function (msg) {
                if (msg != undefined) {
                    that.request({
                        url: "song/search",
                        data: {
                            keyword: msg
                        },
                        success(res) {
                            if (res.data.length == 0) {
                                that.searchSong();
                                return;
                            }
                            let songNameList = [];
                            for (let i in res.data) {
                                songNameList.push({
                                    label: res.data[i].name,
                                    description: res.data[i].singer,
                                    detail: "ID:" + res.data[i].mid
                                });
                            }
                            vscode.window.showQuickPick(
                                songNameList,
                                {
                                    placeHolder: '请选择一首歌点歌吧~'
                                })
                                .then(function (msg) {
                                    if (msg != undefined) {
                                        let mid = msg.detail.replace("ID:", "");
                                        that.request({
                                            url: "song/addSong",
                                            data: {
                                                mid: mid,
                                                room_id: that.data.roomInfo.room_id
                                            },
                                            success(res) {
                                                that.searchSong();
                                            }
                                        });
                                    }
                                });
                        }
                    });
                }
            });
    },
    getPostData(data) {
        let that = this;
        return Object.assign({}, that.data.postBase, data);
    },
    request(_data = {}) {
        let that = this;
        console.log(_data);
        axios.post(that.data.apiUrl + (_data.url || ""), that.getPostData(_data.data || {}))
            .then(function (response) {
                console.log(response);
                switch (response.data.code) {
                    case 200:
                        if (_data.success) {
                            _data.success(response.data);
                        } else {
                            that.showSuccess(response.data.msg);
                        }
                        break;
                    case 401:
                        if (_data.login) {
                            _data.login();
                        } else {
                            vscode.window.showQuickPick(
                                [
                                    "重新登录",
                                ],
                                {
                                    placeHolder: response.data.msg
                                })
                                .then(function (msg) {
                                    switch (msg) {
                                        case '重新登录':
                                            vscode.commands.executeCommand('extension.bbbug.user.login');
                                            break;
                                        default:
                                    }
                                });
                        }
                        break;
                    default:
                        if (_data.error) {
                            _data.error(response.data);
                        } else {
                            that.showError(response.data.msg);
                        }
                }
            })
            .catch(function (error) {
                that.showError(error);
            });
    },
    reConnectWebsocket() {
        let that = this;
        bbbug.websocket.client.connect(that.data.wssUrl);//连接服务器
        console.log("connnetion...");
    },
    postLogin() {
        let that = this;
        that.request({
            url: "user/login",
            data: that.data.form.login,
            success(res) {
                that.data.postBase.access_token = res.data.access_token;
                fs.writeFile(__dirname + "/access_token.bbbug", res.data.access_token, function (error) {
                    if (error) {
                        console.log('写入失败')
                    } else {
                        console.log('写入成功了')
                    }
                });
                that.request({
                    url: "user/getmyinfo",
                    success(res) {
                        that.data.userInfo = res.data;
                        userBar.text = "已登录:" + decodeURIComponent(res.data.user_name);
                        that.showSuccess("登录成功!");
                        that.joinRoomByRoomId(888);
                    }
                });
            }, error(res) {
                that.showError(res.msg);
                that.data.form.login.login_type = false;
                that.data.form.login.user_account = false;
                that.data.form.login.user_password = false;
            }
        });
    },
    messageList: [],
    urldecode(data) {
        return decodeURIComponent(data);
    },
    showRightMessage(msg) {
        // vscode.window.showInformationMessage(msg);
        let that = this;
        msgBar.text = msg;
        msgBar.color = "#ff0";
        clearTimeout(that.data.message.hideMessageTimer);
        that.data.message.hideMessageTimer = setTimeout(function () {
            msgBar.text = '消息中心';
            msgBar.color = "#fff";
        }, 5000);
    },
    updateMessageList() {
        msgList = [];
        msgList.push({
            label: "我要发消息",
            description: "send",
            detail: "选中这里并回车可快速发消息",
        });
        for (let index in bbbug.messageList) {
            let obj = bbbug.messageList[index];
            console.log(obj);
            switch (obj.type) {
                case 'touch':
                    msgList.push({
                        label: decodeURIComponent(obj.user.user_name),
                        description: obj.type,
                        detail: "摸了摸 " + decodeURIComponent(obj.at.user_name) + obj.at.user_touchtip,
                    });
                    break;
                case 'text':
                    if (obj.at) {
                        msgList.push({
                            label: decodeURIComponent(obj.user.user_name) + " 说：",
                            description: obj.type,
                            detail: "@" + decodeURIComponent(obj.at.user_name) + " " + decodeURIComponent(obj.content),
                        });
                    } else {
                        msgList.push({
                            label: decodeURIComponent(obj.user.user_name) + " 说：",
                            description: obj.type,
                            detail: decodeURIComponent(obj.content),
                        });
                    }
                    break;
                case 'link':
                    break;
                case 'img':
                    msgList.push({
                        label: decodeURIComponent(obj.user.user_name) + " 发了一张图：",
                        description: obj.type,
                        detail: decodeURIComponent(obj.resource),
                    });
                    break;
                case 'system':
                    msgList.push({
                        label: "系统消息",
                        description: obj.type,
                        detail: obj.content,
                    });
                    break;
                case 'jump':
                    break;
                case 'join':
                    msgList.push({
                        label: "进入房间提醒",
                        description: obj.type,
                        detail: obj.content,
                    });
                    break;
                case 'addSong':
                    msgList.push({
                        label: "点歌消息",
                        description: obj.type,
                        detail: decodeURIComponent(obj.user.user_name) + " 点了一首: 《" + obj.song.name + "》(" + obj.song.singer + ")",
                    });
                    break;
                case 'push':
                    msgList.push({
                        label: "置顶歌曲",
                        description: obj.type,
                        detail: decodeURIComponent(obj.user.user_name) + " 置顶了歌曲: 《" + obj.song.name + "》(" + obj.song.singer + ")",
                    });
                    break;
                case 'removeSong':
                    msgList.push({
                        label: "移除歌曲",
                        description: obj.type,
                        detail: (decodeURIComponent(obj.user.user_name) + " 移除了歌曲: 《" + obj.song.name + "》(" + obj.song.singer + ")"),
                    });
                    break;
                case 'pass':
                    msgList.push({
                        label: "切掉歌曲",
                        description: obj.type,
                        detail: (decodeURIComponent(obj.user.user_name) + " 切掉了歌曲: 《" + obj.song.name + "》(" + obj.song.singer + ")"),
                    });
                    break;
                case 'passGame':
                    msgList.push({
                        label: "Pass了歌曲",
                        description: obj.type,
                        detail: (decodeURIComponent(obj.user.user_name) + " PASS了歌曲: 《" + obj.song.name + "》(" + obj.song.singer + ")"),
                    });
                    break;
                case 'all':
                    msgList.push({
                        label: "系统消息",
                        description: obj.type,
                        detail: obj.content,
                    });
                    break;
                case 'back':
                    break;
                case 'playSong':
                    break;
                case 'online':
                    break;
                case 'roomUpdate':
                    break;
                case 'game_music_success':
                    msgList.push({
                        label: "猜歌结果",
                        description: obj.type,
                        detail: "恭喜 " + decodeURIComponent(obj.user.user_name) + " 猜中了《" + obj.song.name + "》(" + obj.song.singer + "),30s后开始新一轮游戏",
                    });
                    break;
                case 'story':
                    msgList.push({
                        label: "正在播放声音",
                        description: obj.type,
                        detail: '有声书正在播放声音《' + obj.story.name + '》(' + obj.story.part + ')',
                    });

                    break;
                default:
            }
        }
    },
    messageController(data) {
        let that = this;
        try {
            let obj = {};
            try {
                obj = JSON.parse(decodeURIComponent(data));
            } catch (e) {
                obj = JSON.parse(data);
            }
            obj.time = parseInt(new Date().valueOf() / 1000);
            if (that.messageList.length > 50) {
                that.messageList.pop();
            }
            that.messageList.unshift(obj);
            that.updateMessageList();
            switch (obj.type) {
                case 'touch':
                    if (obj.at) {
                        if (obj.at.user_id == that.data.userInfo.user_id) {
                            //被@
                            that.showRightMessage(decodeURIComponent(obj.user.user_name) + " 摸了摸你" + obj.at.user_touchtip);
                        } else {
                            that.showRightMessage(decodeURIComponent(obj.user.user_name) + " 摸了摸" + decodeURIComponent(obj.at.user_name) + decodeURIComponent(obj.at.user_touchtip));
                        }
                        return;
                    }
                    break;
                case 'text':
                    if (obj.at) {
                        if (obj.at.user_id == that.data.userInfo.user_id) {
                            //被@
                            vscode.window.showInformationMessage(decodeURIComponent(obj.user.user_name) + "@了你: " + decodeURIComponent(obj.content));
                        } else {
                            that.showRightMessage(decodeURIComponent(obj.user.user_name) + " 说: @" + decodeURIComponent(obj.at.user_name) + " " + decodeURIComponent(obj.content));
                        }

                        return;
                    }
                    that.showRightMessage(decodeURIComponent(obj.user.user_name) + " 说: " + decodeURIComponent(obj.content));
                    break;
                case 'link':
                case 'img':
                case 'system':
                case 'jump':
                    that.messageList.push(obj);
                    break;
                case 'join':
                    that.showRightMessage(obj.content);
                    break;
                case 'addSong':
                    if (obj.at) {
                        if (obj.at.user_id == that.data.userInfo.user_id) {
                            //有人送你一首歌
                            vscode.window.showInformationMessage(decodeURIComponent(obj.user.user_name) + " 送歌给你: 《" + obj.song.name + "》(" + obj.song.singer + ")");
                        } else {
                            that.showRightMessage(decodeURIComponent(obj.user.user_name) + " 送歌给 " + decodeURIComponent(obj.at.user_name) + " : 《" + obj.song.name + "》(" + obj.song.singer + ")");
                        }
                        return;
                    }

                    that.showRightMessage(decodeURIComponent(obj.user.user_name) + " 点了一首: 《" + obj.song.name + "》(" + obj.song.singer + ")");
                    break;
                case 'push':
                    that.showRightMessage(decodeURIComponent(obj.user.user_name) + " 置顶了歌曲: 《" + obj.song.name + "》(" + obj.song.singer + ")");
                    break;
                case 'removeSong':
                    that.showRightMessage(decodeURIComponent(obj.user.user_name) + " 移除了歌曲: 《" + obj.song.name + "》(" + obj.song.singer + ")");
                    break;
                case 'pass':
                    that.showRightMessage(decodeURIComponent(obj.user.user_name) + " 切掉了歌曲: 《" + obj.song.name + "》(" + obj.song.singer + ")");
                    break;
                case 'passGame':
                    that.showRightMessage(decodeURIComponent(obj.user.user_name) + " PASS了歌曲: 《" + obj.song.name + "》(" + obj.song.singer + ")");
                    break;
                case 'all':
                    that.showRightMessage("系统消息: " + obj.content);
                    break;
                case 'back':
                    // that.showRightMessage(decodeURIComponent(obj.user.user_name) + " 测回了一条消息。");
                    break;
                case 'playSong':
                    if (!obj.song || !obj.user) {
                        return;
                    }
                    that.data.songInfo = obj;
                    musicBar.text = "$(clock) 播放中:" + obj.song.name + "(" + obj.song.singer + ")";
                    playerPanel.webview.postMessage({
                        evt: "play",
                        url: "https://api.bbbug.com/api/song/playurl?mid=" + obj.song.mid
                    });
                    break;
                case 'online':
                    that.data.userList = obj.data;
                    onlineBar.text = "$(smiley) 在线" + obj.data.length;
                    break;
                case 'roomUpdate':
                    that.joinRoomByRoomId(that.data.roomInfo.room_id);
                    break;
                case 'game_music_success':
                    that.showRightMessage("恭喜 " + that.urldecode(obj.user.user_name) + " 猜中了《" + obj.song.name + "》(" + obj.song.singer + "),30s后开始新一轮游戏");
                    break;
                case 'story':
                    that.showRightMessage('有声书正在播放声音《' + obj.story.name + '》(' + obj.story.part + ')');
                    that.audioUrl = obj.story.play;
                    that.chat_room.voice = obj.story;
                    that.isAudioCurrentTimeChanged = false;

                    break;
                default:
            }
        } catch (error) {
            console.log(error)
        }
    },
    showRoomList() {
        vscode.commands.executeCommand("extension.bbbug.room.select");
    },
    joinRoomByRoomId(room_id, room_password = "") {
        let that = this;
        that.websocket.forceStop = true;
        if (that.websocket.isConnected) {
            console.log("等待退出房间");
            that.websocket.connection.send("bye");
            setTimeout(function () {
                that.joinRoomByRoomId(room_id, room_password);
            }, 100);
            return;
        }
        that.request({
            url: "room/getRoomInfo",
            data: {
                room_id: room_id,
                room_password: room_password
            },
            success(res) {
                that.data.roomInfo = res.data;
                roomBar.text = "$(bug) " + res.data.room_name + "(ID:" + res.data.room_id + ")";
                that.request({
                    url: "room/getWebsocketUrl",
                    data: {
                        channel: room_id,
                        password: room_password
                    },
                    success(res) {
                        that.data.wssUrl = "wss://websocket.bbbug.com/?account=" + res.data.account + "&channel=" + res.data.channel + "&ticket=" + res.data.ticket;
                        console.log(that.data.wssUrl);
                        that.reConnectWebsocket();
                        that.showSuccess("连接房间服务器成功");
                    }
                });
            },
            error(res) {
                switch (res.code) {
                    case that.data.code.room_password_error:
                        vscode.window.showInputBox(
                            {
                                placeHolder: '请输入房间密码...',
                                prompt: res.msg

                            }).then(function (msg) {
                                if (msg == undefined) {
                                    that.showRoomList();
                                } else {
                                    that.joinRoomByRoomId(room_id, room_password);
                                }
                            });
                        break;
                    default:
                        that.showError(res.msg);
                        that.showRoomList();
                }
            }
        });
    },
    sendMessage() {
        let that = this;
        vscode.window.showInputBox(
            {
                placeHolder: '说点什么吧...',
                prompt: that.data.message.at ? ("@" + decodeURIComponent(that.data.message.at.user_name)) : "",
            }).then(function (msg) {
                if (msg != undefined) {
                    that.request({
                        url: "message/send",
                        data: {
                            where: 'channel',
                            to: that.data.roomInfo.room_id,
                            type: 'text',
                            at: that.data.message.at || null,
                            msg: encodeURIComponent(msg)
                        },
                        success(res) {
                            that.data.message.at = false;
                            that.sendMessage();
                        }
                    });
                } else {
                    that.data.message.at = false;
                }
            });
    }
};