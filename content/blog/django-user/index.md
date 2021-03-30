---
title: Django -- 用户模块
date: '2021-03-28'
description: Django 用户模块搭建，基于JWT的登录登出系统、微信登录对接。
order: 51
---

上一篇 [Django 从开发到部署](/django) 介绍了 Django 的基本操作。这篇将基于上一篇的代码，来扩展一个用户模块。

该模块基于 Django 自带的 auth 模块进行扩展，并实现了微信扫码登录的后端功能。

### 模块概览

<img src="./images/catalogue.png" alt="catalogue" />
<br />

其中：

- **user/libs:** 用户模块相关工具库。
- **user/libs/jwt:** jwt 相关工具库，包括 token 的创建、校验、登录状态中间件。
- **user/libs/wx_login:** 微信登录相关工具库。

...

> 其他文件就是 Django 的套路了，不一一介绍了。

### 表结构设计

分成两张表，一张是用户表（User），一张是 Oauth 登录信息表（Oauth）。

1. User 表

继承 django.contrib.auth.models.AbstractUser

nickname 昵称 </br>
avatar_url 头像 </br>
gender 性别 </br>
phone_number 电话号码

2. Oauth 表

user 外键指向某个用户 </br>
oauth_type 渠道（微信或者其他渠道） </br>
oauth_id 渠道提供的该用户的唯一 id </br>
created_time 创建时间 </br>
last_mod_time 最后修改时间

### 微信扫码登录流程

请先阅读官方文档：[微信登录流程](https://developers.weixin.qq.com/doc/oplatform/Website_App/WeChat_Login/Wechat_Login.html)。

流程已经很清晰了：

1. 获取 code
2. 通过 code 获取 access_token
3. 使用 access_token 去获取用户信息（unionid、用户昵称、用户头像）
4. 后端将微信 unionid 和 数据库中的用户信息进行对应，完成用户登录

#### 前端要做的事情

```js
// 先引入 http://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js

var obj = new WxLogin({
  self_redirect: true,
  id: 'login_container',
  appid: '',
  scope: '',
  redirect_uri: '',
  state: '',
  style: '',
  href: '',
});
```

好好研究上面这段代码的传参，其实已经明确了流程。

1. 参数 id

这段代码会在 id 对应的 dom 节点上渲染一个 iframe 元素，在这个 iframe 元素中展示的是登录用的二维码。

2. 参数 redirect_uri

在用户扫码之后，点击了确认授权，该 iframe 会发起一个重定向请求到 redirect_uri，而在它的 query 中会携带上 code。而这个 redirect_uri 便是我们后端要开的一个接口（这边称它为 callback 接口）。

到这步为止，其实已经完成第一步，后端已经获取到 code 了，二三两步自然能很容易在后端完成。

那么，还有个问题，后端 callback 接口中处理完 1 ～ 4 步，用户已经登录成功，怎么通知前端页面呢？

我的方案是：

1. 后端再提供一个供前端轮询的接口，前端加载出二维码之后开始发起轮询， 轮询的时候带一个 uuid。如果接口返回中带有 token，表示用户已登录成功，否则继续轮询。

2. 前端在 redirect_uri 中也带上 1 中的那个 uuid，后端在 callback 接口中获取到该 uuid，以该 uuid 为 key，将登录完成后的 token 存在 redis 中。在 1 的轮询接口中，
   使用 uuid 为 key 去 redis 中查询，如果 token 存在则表明用户已登录，返回 token，否则未登录。

> uuid 可以放在 state 参数中，因为 state 参数会自动拼接到 redirect_uri 里去

#### 后端要做的事情

后端需要提供两个接口：

1. login/wx/

2. login/wx/callback/

第一个接口供前端轮询是否已经登录成功；第二个接口是用户授权后 iframe 重定向的地址，在该接口中可以获取到 code，进而处理用户登录逻辑。

### 代码实现

安装依赖。

```shell
pip install djangorestframework-jwt channels channels-redis
```

修改配置。

**main/settings/base.py**

```py
...

'''
Redis
'''
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [('127.0.0.1', 6379)],
        },
    },
}

CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': 'redis://127.0.0.1:6379',
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        }
    }
}

SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
SESSION_CACHE_ALIAS = 'default'

...

'''
Rest Framework
'''
REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': (),
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_jwt.authentication.JSONWebTokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.BasicAuthentication',
    ),
}

...

'''
Application definition
'''
INSTALLED_APPS = [
    ...,
    'channels',
    'apps.user',
]

...

AUTH_USER_MODEL = 'user.User'
```

在 main url 中添加 user 相关路由。

**main/urls.py**

```py
...

urlpatterns = [
    ...,
    path('api/user/', include('apps.user.urls'))
]
```

main 中的设置基结束了，下面是 user 模块的代码。

一个模块我习惯先从 models 入手，先定义出对象的数据结构。

**user/models.py**

```py
from django.db import models
from django.utils.timezone import now
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy
from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    nickname = models.CharField(
        '昵称',
        max_length=225,
        default=''
    )
    avatar = models.CharField(
        '头像',
        max_length=225,
        default=''
    )
    gender = models.CharField(
        '性别',
        max_length=225,
        default=''
    )
    phone = models.CharField(
        '手机号码',
        max_length=225,
        default=''
    )

    class Meta:
        verbose_name = '用户'
        verbose_name_plural = verbose_name
        ordering = ['-date_joined']


class Oauth(models.Model):
    OAUTH_TYPE = (
        ('weixin', '微信'),
    )

    user = models.ForeignKey(
        'user',
        related_name='contained_oauths',
        on_delete=models.CASCADE
    )
    oauth_type = models.CharField(
        '类型',
        max_length=10,
        choices=OAUTH_TYPE,
    )
    oauth_id = models.CharField(
        'oauth id',
        max_length=200
    )
    created_time = models.DateTimeField(
        '创建时间',
        default=now
    )

    def clean(self):
        if Oauth.objects.filter(oauth_type=self.oauth_type).exclude(id=self.id).count():
            raise ValidationError(gettext_lazy(self.oauth_type + '已经存在'))

    def __str__(self):
        return self.oauth_type

    class Meta:
        verbose_name = 'Oauth 信息'
        verbose_name_plural = '用户 / Oauth'
        ordering = ['-created_time']

```

**user/serializers.py**

```py
from rest_framework import serializers
from .models import User, Oauth


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'nickname', 'avatar_url', 'gender', 'phone_number')


class OauthSerializer(serializers.ModelSerializer):
    class Meta:
        model = Oauth
        fields = ('id', 'user', 'oauth_type', 'created_time', 'last_mod_time')

```

**user/urls.py**

```py
from django.urls import path
from . import views

urlpatterns = [
    path('login/wx/', views.WeixinLoginView.as_view()),
    path('login/wx/callback/', views.WeixinLoginCallbackView.as_view()),
    path('logout/', views.LogoutView.as_view()),
    path('current/', views.CurrentView.as_view())
]
```

**user/admin.py**

```py
from django.contrib import admin
from .models import User, Oauth


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ['id', 'username', 'nickname',
                    'avatar_url', 'gender', 'phone_number', 'date_joined']
    list_display_links = ['id', 'username']
    ordering = ['id']

    empty_value_display = '--'


@admin.register(Oauth)
class OauthAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'oauth_type',
                    'oauth_id', 'created_time', 'last_mod_time']
    list_display_links = ['id', 'user']
    ordering = ['id']

    empty_value_display = '--'

```

**user/libs/jwt.py**

```py
import jwt
import datetime
from jwt import exceptions
from django.conf import settings
from django.core.cache import cache
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from apps.user.models import User
from apps.user.serializers import UserSerializer


def checkToken(token):
    salt = settings.SECRET_KEY

    try:
        result = jwt.decode(token, salt, True)
    except exceptions.ExpiredSignatureError:
        return 'token过期失效'
    except exceptions.DecodeError:
        return 'token认证失败'
    except exceptions.InvalidTokenError:
        return '无效的token'

    # 检查  token 是否在 redis 中存在，防止多设备登录
    user_id = result['id']
    user_token_key = 'usertoken_%d' % user_id
    if cache.get(user_token_key) != token:
        return '无效的token'

    return {'result': result, 'user_id': user_id}


class JwtQuertParamsAuthentication(BaseAuthentication):
    """
    使用：在试图类中添加 authentication_classes = [JwtQuertParamsAuthentication]
    """

    def authenticate(self, request):
        token = request.META.get('HTTP_IDTOKEN', None)

        c = checkToken(token)
        if type(c) is str:
            raise AuthenticationFailed({'code': 1001, 'msg': c})
        result = c['result']
        user_id = c['user_id']

        user = User.objects.get(id=user_id)
        user_data = UserSerializer(user).data
        request.token = token
        request.user_data = user_data
        request.user_object = user

        return {'result': result, 'token': token}


def get_token(payload):
    salt = settings.SECRET_KEY
    headers = {
        'typ': 'jwt_',
        'alg': 'HS256',
    }
    payload['exp'] = datetime.datetime.utcnow(
    ) + datetime.timedelta(days=50000)
    token = jwt.encode(
        payload=payload,
        key=salt,
        headers=headers
    ).decode('utf-8')

    return token

```

**user/libs/wx_login.py**

```py
import pickle
from django.core.cache import cache
from apps.user.models import User
from apps.user.serializers import UserSerializer


class WxLogin:
    @staticmethod
    def get_wx_code_map():
        key = 'WeixinCodeMap'

        res = cache.get(key)
        if not res:
            return {}
        else:
            return pickle.loads(res)

    @staticmethod
    def set_wx_code_map(wx_code_map):
        key = 'WeixinCodeMap'

        cache.set(key, pickle.dumps(wx_code_map), timeout=None)

    def query(self, uuid):
        wx_code_map = self.get_wx_code_map()

        res = wx_code_map.get(uuid, None)

        if not res:
            return None
        else:
            del wx_code_map[uuid]
            self.set_wx_code_map(wx_code_map)

            return res

    def update(self, uuid, code):
        wx_code_map = self.get_wx_code_map()
        wx_code_map[uuid] = code

        self.set_wx_code_map(uuidmap)


wxlogin = WxLogin()

```

完成了上面一些列铺垫，终于到了最重要的实现接口的时候了。

**user/views.py**

```py
import json
import logging
import requests
from uuid import uuid4
import urllib.parse as urlparse
from django.conf import settings
from django.core.cache import cache
from django.shortcuts import render
from rest_framework.response import Response
from rest_framework.views import APIView
from .libs.jwt import get_token, JwtQuertParamsAuthentication
from .libs.wx_login import wxlogin
from .models import User, Oauth
from .serializers import UserSerializer, OauthSerializer

logger = logging.getLogger()


class WeixinLoginView(APIView):
    def get_token_info(self, code):
        url = 'https://api.weixin.qq.com/sns/oauth2/access_token?appid=APPID&secret=SECRET&code=CODE&grant_type=authorization_code'
        url = url.replace('APPID', 'your appid')
        url = url.replace('SECRET', 'your secret')
        url = url.replace('CODE', code)
        res = requests.get(url).json()
        return res

    # 用 access_token 和 openid 去换取微信用户信息
    def get_wx_user_info(self, access_token, openid):
        url = 'https://api.weixin.qq.com/sns/userinfo?access_token=ACCESS_TOKEN&openid=OPENID'
        url = url.replace('ACCESS_TOKEN', access_token)
        url = url.replace('OPENID', openid)
        res = requests.get(url).json()
        return res

    def set_token_to_cache(self, token, user_id):
        user_token_key = 'userToken_%d' % user_id
        # 设置一条永不过期的记录，以后每次 login 都会刷新这条记录
        cache.set(user_token_key, token, timeout=None)

    def get(self, request):
        querys = urlparse.parse_qs(request.META['QUERY_STRING'])
        uuid = querys.get('uuid', [None])[0]

        if uuid is None:
            return Response({'code': 'params-error', 'msg': '缺少参数 uuid'})

        code = wxlogin.query(uuid)

        if code is None:
            return Response({'code': 200, 'data': {}, 'msg': '找不到该 uuid 匹配的 code'})

        # 根据 code 获取 accesstoken
        token_info = self.get_token_info(code)
        errcode = token_info.get('errcode', None)
        if errcode is not None:
            errmsg = token_info.get('errmsg', None)
            logger.error('[获取 AccessToken 失败] errcode: ' +
                         str(errcode) + ', errmsg: ' + errmsg)

            return Response({'code': errcode, 'msg': errmsg})

        access_token = token_info.get('access_token')
        openid = token_info.get('openid')

        # 用 access_token 和 openid 去换取微信用户信息
        wx_user_info = self.get_wx_user_info(access_token, openid)
        errcode = wx_user_info.get('errcode')
        if errcode is not None:
            errmsg = wx_user_info.get('errmsg')
            logger.error('[获取微信用户信息失败] errcode: ' +
                         str(errcode) + ', errmsg: ' + errmsg)

            return Response({'code': errcode, 'msg': errmsg})

        unionid = wx_user_info.get('unionid')

        # 从 Oauth.user 中获取用户信息，若 Oauth 不存在则同时创建 Oauth 和 User
        user = None
        oauth = None
        try:
            oauth = Oauth.objects.get(oauth_type='weixin', oauth_id=unionid)
            oauth_data = OauthSerializer(oauth).data
            user_id = oauth_data['user']
            user = User.objects.get(pk=user_id)
            user.nickname = wx_user_info.get(
                'nickname').encode("iso-8859-1").decode()
            user.avatar_url = wx_user_info.get('headimgurl')
            user.save()
        except Oauth.DoesNotExist:
            user = User(
                username='user_' + str(uuid4()),
                nickname=wx_user_info.get('nickname'),
                gender='男' if wx_user_info.get('sex') == 1 else '女',
                avatar_url=wx_user_info.get('headimgurl')
            )
            user.save()
            oauth = Oauth(oauth_type='weixin', oauth_id=unionid, user=user)
            oauth.save()
        oauth_data = OauthSerializer(oauth).data
        user_data = UserSerializer(user).data

        # 使用 user.id 和 user.username 生成 jwt token
        payload = {
            'id': user_data['id'],
            'username': user_data['username']
        }
        token = get_token(payload)

        # 将 jwt 存到 redis 中，防止重复登录
        self.set_token_to_cache(token, user.id)

        return Response({'code': 200, 'data': {'token': token}})


class WeixinLoginCallbackView(APIView):
    def get(self, request):
        querys = urlparse.parse_qs(request.META['QUERY_STRING'])
        uuid = querys.get('state', [None])[0]
        code = querys.get('code', [None])[0]

        if code is None:
            return Response({'code': 'params-error', 'msg': '缺少参数 code'})

        if uuid is None:
            return Response({'code': 'params-error', 'msg': '缺少参数 uuid'})

        wxlogin.update(uuid, code)

        response = render(request, 'wx-login-success.html')
        response['X-Frame-Options'] = 'ALLOW-FROM http://localhost/'

        return response


class LogoutView(APIView):
    authentication_classes = [JwtQuertParamsAuthentication]

    def remove_token_from_cache(self, token, user_id):
        user_token_key = 'userToken_%d' % user_id
        cache.delete_pattern(user_token_key)

    def post(self, request):
        user_data = request.user_data
        token = request.token

        user_id = user_data['id']
        self.remove_token_from_cache(token, user_id)

        return Response({'code': 200, 'msg': '登出成功'})


class CurrentView(APIView):
    authentication_classes = [JwtQuertParamsAuthentication]

    def get(self, request):
        user_data = request.user_data

        return Response({'code': 200, 'data': user_data})

```

理论上你只需要替换 APPID 和 SECRET 就能使用了，但是这边还有一个小东西，即 `response = render(request, 'wx-login-success.html')` 这行小代码，我们可以把登录成功之后 iframe 需要展示的内容在接口中返回。这边利用 django 的 render 方法渲染了一个 html 模版，将渲染后的 html 格式的字符串返回。这样，iframe 里原来显示的是二维码，然后用户授权发起重定向，登录成功之后就会显示出我们后端 callback 接口返回的 html。

**templates/wx-login-success.html**

> templates 放在根目录下, wx-login-success.html 样式只是作为参考，可以自由发挥。

```html
<!DOCTYPE html>
<html>
  <head>
    <title>登录成功</title>
    <style type="text/css">
      body {
        position: relative;
        height: 100vh;
        overflow: hidden;
      }

      .container {
        width: 50%;
        position: absolute;
        text-align: center;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }

      .icon {
        width: 60%;
        overflow: hidden;
        vertical-align: middle;
      }

      .tip {
        font-size: 3em;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <svg
        t="1615970048484"
        class="icon"
        viewBox="0 0 1024 1024"
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        p-id="5130"
        data-spm-anchor-id="a313x.7781069.0.i1"
      >
        <path
          d="M512 952.32c243.17952 0 440.32-197.14048 440.32-440.32s-197.14048-440.32-440.32-440.32-440.32 197.14048-440.32 440.32 197.14048 440.32 440.32 440.32z m0 46.08c-268.63104 0-486.4-217.76896-486.4-486.4S243.36896 25.6 512 25.6s486.4 217.76896 486.4 486.4-217.76896 486.4-486.4 486.4z m-315.04384-472.23808a23.04 23.04 0 1 1 36.16768-28.55424l149.66272 189.54752a17.92 17.92 0 0 0 26.63424 1.66912l352.6656-346.84928a23.04 23.04 0 0 1 32.3072 32.84992l-352.6656 346.8544a64 64 0 0 1-5.21216 4.59776c-27.74016 21.90848-67.98848 17.1776-89.89184-10.56768l-149.66784-189.5424z"
          fill="#88D0AD"
          p-id="5131"
        ></path>
      </svg>
      <p class="tip">微信登录成功</p>
    </div>
  </body>
</html>
```
