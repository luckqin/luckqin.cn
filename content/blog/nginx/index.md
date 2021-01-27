---
title: Nginx
date: '2021-01-27'
description: Nginx 学习记录，常用配置和命令。
---

NGINX is a free, open-source, high-performance HTTP server and reverse proxy, as well as an IMAP/POP3 proxy server. NGINX is known for its high performance, stability, rich feature set, simple configuration, and low resource consumption.

### 编译 Nginx

1. 在 [Nginx Download](http://nginx.org/en/download.html) 选择合适的版本，拷贝下载链接并进行安装：

```shell
wget http://nginx.org/download/nginx-1.18.0.tar.gz
tar -xzf nginx-1.18.0.tar.gz
cd nginx-1.18.0
cp -r contrib/vim/* ~/.vim/
```

2. 配置

configure 是一些编译配置项，可以使用 `help` 命令查看有哪些配置选项。

```shell
./configure --help ｜ more
```

configure 配置项大概分为三类

- `--with-xxx-module` 表示原本没有的模块，需要主动添加到 nginx 中
- `--without-xxx-module` 表示原本已有这个模块，需要移除
- `--prefix`, `--with-cc` 等其他配置项

编译前的检查和配置

```shell
# 编译 nginx 需要的前置依赖
yum -y install gcc gcc-c++
yum -y install make
yum -y install pcre-devel
yum -y install zlib-devel

./configure --prefix=/home/nginx
```

完成配置之后，若没有报错，会生成 `objs` 中间文件夹。

```shell
cd objs
cat ngx_modules.c # 查看接下来编译时，有哪些模块会被编译进 nginx
```

3. 开始编译

```shell
make
make install
```

### 开启 Nginx

```shell
cd /home/nginx/sbin
./nginx
```

此时，Nginx 已经被成功开启，可以通过以下命令查看 Nginx 进程。

```shell
ps -ef | grep nginx
```

### 重载 Nginx

修改配置文件内容。

```shell
cd path/to/nginx
vim conf/nginx.conf
```

重载。

```shell
./sbin/nginx -s reload
```

### 升级 Nginx

把新编译出来的 nginx 二进制文件（sbin/nginx）替换调旧的进程正在使用的 nginx 二进制文件。

```shell
mv /path/to/new/nginx ./.sbin/nginx
```

停用当前进程并启用新进程（平滑地升级）。

```shell
kill -USR2 `cat path/to/nginx/logs/nginx.pid`
ps -ef | grep nginx
```

此时，可以看到新老 nginx 进程都在运行，但老 nginx 的 worker 进程已经不再监听 80 端口了。

优雅地关闭老进程。

```shell
kill -WINCH `cat path/to/nginx/logs/nginx.pid.oldbin`
ps -ef | grep nginx
```

此时，老的 worker 进程被关闭了，但 master 进程还在，为了方便做版本回退。

> 如果使用 `kill -QUIT` 就可以把 master 进程关闭。

### 日志切割

通过重启 nginx 形成新日志来实现。

```shell
cd path/to/nginx/logs
mv access.log access-bak.log
../sbin/nginx -s reopen
```

这三行命令可以使用 `crontab` 定时执行脚本来实现。
