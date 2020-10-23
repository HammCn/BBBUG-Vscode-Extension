const vscode = require('vscode');
const axios = require('axios');
let WebSocketClient = require('websocket').client;//获取websocketclient模块
let roomBar, musicBar, onlineBar;
exports.activate = function (context) {
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
        //连接错误抛出
        bbbug.websocket.isConnected = true;
        bbbug.websocket.connection = connection;
        connection.on('error', function (error) {
            bbbug.websocket.isConnected = false;
            console.log("Connection Error: " + error.toString());

        });
        //连接关闭执行
        connection.on('close', function () {
            bbbug.websocket.isConnected = false;
            if (!bbbug.websocket.forceStop) {
                console.log("需要重连");
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
    onlineBar.color = "#fff";
    onlineBar.command = "extension.bbbug.online";
    onlineBar.show();

    musicBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    musicBar.text = '$(clock) 加载中...';
    musicBar.color = "#ff0";
    musicBar.command = "extension.bbbug.song.menu";
    musicBar.show();

    vscode.commands.registerCommand('extension.bbbug.song.menu', function () {
        if (!bbbug.data.userInfo) {
            vscode.commands.executeCommand('extension.bbbug.user.login');
            return;
        }
        vscode.window.showQuickPick(
            [
                "点歌",
                "播放列表",
                "切掉这首歌",
                "不喜欢这首歌",
            ],
            {
                placeHolder: '选择你想干嘛?'
            })
            .then(function (msg) {
                switch (msg) {
                    case '点歌':
                        bbbug.searchSong();
                        break;
                    case '切掉这首歌':
                    case '不喜欢这首歌':
                        if (!bbbug.data.songInfo) {
                            bbbug.showError("当前没有播放中的歌曲");
                            return;
                        }
                        bbbug.request({
                            url: "song/pass",
                            data: {
                                mid: bbbug.data.songInfo.song.mid,
                                room_id: bbbug.data.roomInfo.room_id
                            },
                            success(res) {
                                bbbug.showSuccess(res.data.msg);
                            }
                        });
                        break;
                    case '播放列表':
                        bbbug.showPickedSongList();
                        break;
                    default:
                }
            });
    });
    vscode.commands.registerCommand('extension.bbbug.room.select', function () {
        let roomList = [];
        if (bbbug.data.userInfo.myRoom) {
            roomList.push(bbbug.data.userInfo.myRoom);
        }
        console.log(123);
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
    vscode.commands.registerCommand('extension.bbbug.room.menu', function () {
        if (!bbbug.data.userInfo) {
            vscode.commands.executeCommand('extension.bbbug.user.login');
            return;
        }
        vscode.window.showQuickPick(
            [
                "去大厅",
                "切换房间",
                "去我的房间",
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
                    case '去我的房间':
                        if (bbbug.data.userInfo.myRoom) {
                            bbbug.joinRoomByRoomId(bbbug.data.userInfo.myRoom.room_id);
                        } else {
                            bbbug.showError("请先去bbbug.com创建一个私有房间后再进入！");
                        }
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
                    switch (msg) {
                        case '使用密码登录':
                            bbbug.data.form.login.login_type = "password";
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
                            bbbug.sendEmail();
                        }
                    }
                });
            return;
        }
        if (!bbbug.data.form.login.user_password) {
            vscode.window.showInputBox(
                {
                    password: true,
                    placeHolder: bbbug.data.form.login.login_type == "password" ? "请输入你的登录密码" : "请输入你收到的验证码",
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
        // bbbug.data.form.login.login_type = false;
        // bbbug.data.form.login.user_account = false;
        // bbbug.data.form.login.user_password = false;
    });


    vscode.commands.registerCommand('extension.bbbug.online', function () {
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
                    });
            }
        });


    });

    vscode.commands.registerCommand('extension.bbbug', function () {
        bbbug.init();
    });
};
exports.deactivate = function () {
};
let bbbug = {
    data: {
        apiUrl: "https://api.bbbug.com/api/",
        wssUrl: false,
        postBase: {
            access_token: "ad6baeaf725cf797a2f2ef790470a4e658a67623100000ad6baeaf725cf797a2f2ef790470a4e658a67623",
            // access_token:false,
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
            hideStatusTimer: false
        },
        userInfo: false,
        roomInfo: false,
        songInfo: false,
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
    showSuccess(msg) {
        vscode.window.showInformationMessage(msg);
    },
    showError(msg) {
        vscode.window.showErrorMessage(msg);
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
                                                that.showSuccess(res.data.msg);
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
        // _data.loading && (that.loading = true);
        console.log(_data);
        axios.post(that.data.apiUrl + (_data.url || ""), that.getPostData(_data.data || {}))
            .then(function (response) {
                console.log(response);
                // _data.loading && (that.loading = false);
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
                                            that.data.form.login.login_type = false;
                                            that.data.form.login.user_account = false;
                                            that.data.form.login.user_password = false;
                                            that.login();
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
                console.log(res.data.access_token);
                that.data.postBase.access_token = res.data.access_token;

                that.request({
                    url: "user/getmyinfo",
                    success(res) {
                        that.data.userInfo = res.data;
                        that.showSuccess("登录成功!");
                        that.joinRoomByRoomId(888);
                    }
                });
            }
        });
    },
    init() {
        let that = this;
        if (!that.data.postBase.access_token) {
            that.data.form.login.user_account = false;
            that.data.form.login.user_password = false;
            that.login();
            return;
        }
        if (!that.data.roomInfo) {
            that.showRoomList();
            return;
        }

    },
    showRoomList() {
        let that = this;
        let roomList = [];

    },
    messageList: [],
    addSystemMessage(msg) {

    },
    urldecode(data) {
        return decodeURIComponent(data);
    },
    showRightMessage(title, msg) {
        let that = this;
        vscode.window.showInformationMessage(title);
    },
    showStatusMessage(title, msg) {
        let that = this;
        vscode.window.showInformationMessage(title + msg);
        return;
        clearTimeout(that.data.message.hideStatusTimer);
        that.data.message.hideStatusTimer = setTimeout(function () {
            clearTimeout(that.data.message.statusTimer);
            vscode.window.setStatusBarMessage("");
        }, 5000);
        that.animationTask(title, "________________" + msg + "________________");
    },
    animationTask(title, msg) {
        let that = this;
        clearTimeout(that.data.message.statusTimer);
        that.data.message.statusTimer = setTimeout(function () {
            let arr = msg.split("");
            arr.push(arr.shift());
            msg = arr.join("");
            vscode.window.setStatusBarMessage(title + " " + msg);
            that.animationTask(title, msg);
        }, 100);
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
            console.log(obj);
            switch (obj.type) {
                case 'touch':
                    break;
                case 'text':
                    that.showRightMessage(decodeURIComponent(obj.user.user_name) + " 说: " + decodeURIComponent(obj.content));
                    if (obj.at) {
                        console.log(that.data.userInfo);
                        if (obj.at.user_id == that.data.userInfo.user_id) {
                            //被@
                            console.log(decodeURIComponent(obj.at.user_name) + "@了你: " + decodeURIComponent(obj.content));
                            vscode.window.showInformationMessage(decodeURIComponent(obj.at.user_name) + "@了你: " + decodeURIComponent(obj.content));
                        }
                    }
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
                            vscode.window.showInformationMessage(decodeURIComponent(obj.at.user_name) + "送了你歌: 《" + obj.song.name + "》(" + obj.song.singer + ")");
                        }
                    }

                    that.showRightMessage(decodeURIComponent(obj.user.user_name) + " 点歌: 《" + obj.song.name + "》(" + obj.song.singer + ")");
                    break;
                case 'push':
                    that.showRightMessage(decodeURIComponent(obj.user.user_name) + " 置顶歌曲: 《" + obj.song.name + "》(" + obj.song.singer + ")");
                    break;
                case 'removeSong':
                    that.showRightMessage(decodeURIComponent(obj.user.user_name) + " 移出歌曲: 《" + obj.song.name + "》(" + obj.song.singer + ")");
                    break;
                case 'pass':
                    that.showRightMessage(decodeURIComponent(obj.user.user_name) + " 切掉了歌曲: 《" + obj.song.name + "》(" + obj.song.singer + ")");
                    break;
                case 'passGame':
                    that.showRightMessage(decodeURIComponent(obj.user.user_name) + " PASS了歌曲: 《" + obj.song.name + "》(" + obj.song.singer + ")");
                    break;
                case 'all':
                    that.showRightMessage("系统消息: ", obj.content);
                    break;
                case 'back':
                    that.showRightMessage(decodeURIComponent(obj.user.user_name) + " 测回了一条消息: ", "哈哈哈我就是不告诉你我说了啥");
                    break;
                case 'playSong':
                    that.data.songInfo = obj;
                    console.log("https://api.bbbug.com/api/song/playurl?mid=" + obj.song.mid);
                    musicBar.text = "$(clock) 播放中:" + obj.song.name + "(" + obj.song.singer + ")";
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
    joinRoomByRoomId(room_id, room_password = "") {
        let that = this;
        if (room_id == that.data.roomInfo.room_id) {
            that.showRoomList();
            return;
        }
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
            }).then(function (msg) {
                if (msg == undefined) {
                    that.init();
                } else {
                    that.request({
                        url: "message/send",
                        data: {
                            where: 'channel',
                            to: that.data.roomInfo.room_id,
                            type: 'text',
                            at: that.data.at || null,
                            msg: encodeURIComponent(msg)
                        },
                        success(res) {
                            that.sendMessage();
                        }
                    });
                }
            });
    }
};