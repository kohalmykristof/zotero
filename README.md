Zotero Standalone Build - How to
======

Mainly based on https://www.zotero.org/support/dev/client_coding/building_the_standalone_client

# 1. Get repositories

## 1.1. https://github.com/kohalmykristof/zotero

Zotero core. Clone to your work folder and checkout branch 4.0

## 1.2. https://github.com/kohalmykristof/zotero-build

Zotero build repository. Modified build scripts.

Clone to your work folder also.

## 1.3. https://github.com/kohalmykristof/zotero-standalone-build

Zotero standalone build repository. Original from zotero's github. Clone to your work folder also.

# 2. checking requirements

In your work folder, change to zotero-standalone-build repository's (see 1.3.) folder:

```shell
cd zotero-standalone-build
```

Then call check requirement script:

```shell
scripts/check_requirements
```

You'll need build requirements only, distribution requirements aren't neccessary.

# 2.1. further requirements

On my Ubuntu 16.04., I had to install 7zip CLI

```shell
sudo apt-get install p7zip
sudo apt-get install p7zip-full
```

(xulrunner fetch script will use 7z command in case of Windows build)

# 3. Fetch and modifiy Mozilla Firefox's runtime files xulrunner into zotero-standalone-build/xulrunner directory

```shell
./fetch_xulrunner.sh -p wl
```

These commands will fetch Firefox's runtime files for Windows and Linux platform. We don't support any MAC platform builds. If it is also required, further dependencies needed also.

# 4. Build XPI from Zotero source

XPI building and signing by Mozilla from Zotero Core in your work folder's zotero subdirectory (see 1.1.).

# 4.1. Create built XPI archive

You can do this build in zotero-build repository's xpi subfolder (see 1.2.).

```shell
cd ../zotero-build/xpi
```

You'll have to use build_xpi_4.0 script with 6 arguments in the next order:

| # | parameter | value | description |
|---|-----------|-------|-------------|
| 1 | branch | 4.0 | zotero core's branch |
| 2 | channel | e.g. 'release' | strips revision number and build info. It can be 'beta' also. |
| 3 | XPI suffix | 4.0.29.17.FETI | suffix of XPI to reference in update.rdf, defaults to "build" |
| 4 | RDF suffix | leave blank | suffix of update RDF file to reference in install.rdf, leave blank to leave as 'update.rdf' |
| 5 | XPI dir | leave blank | extra directory to point to when referencing the XPI and update RDF, defaults to blank (i.e. zotero.org/download/update*.rdf) |
| 6 | Build suffix | leave blank | default: 'build' |

Run command:
```shell
./build_xpi_4.0 4.0 release 4.0.29.17.FETI
```

Build script will clone zotero core repository from GitHub recursively and it will checkout to specified branch.

If everything goes well, you'll get:
- an XPI build in zotero-build/xpi/build/zotero folder
- a zipped archive in zotero-build/xpi/build (zotero-build.xpi)
- an update-build.rdf in zotero-build/xpi/build with feti.hu url (similar to update.rdf in zotero core repository).

Note: versioning in core need a concatenated '.SOURCE' which is stripped in XPI build. Versioning in zotero/install.rdf and zotero/update.rdf is '4.0.29.17.FETI.SOURCE'.

If you need to revert, delete everything in zotero-build/xpi/build folder except .gitignore file.

# 4.2. Create signed Mozilla Add-On available in addons.mozilla.org (AMO)

Use previously built XPI file (see 4.1.) to make signed Mozilla Add-On.

First, you'll need Mozilla's jpm package, available on npm:

```shell
npm install jpm
```

Sign built XPI file by Mozilla:
```shell
cd build
jpm sign --api-key YOUR_API_KEY --api-secret YOUR_API_SECRET --xpi ./zotero-build.xpi
```

If signing finished well, you will get a signed XPI file into your current folder named as 'zotero_patch-4.0.29.17.FETI-fx.xpi'. If version is already signed, its signed XPI file is available in your AMO account (http://addons.mozilla.org).

# 5. Build Zotero Standalone

First, you have to switch into zotero-standalone repository's folder:

```shell
cd ../../zotero-standalone-build
```

You'll have to run ./build.sh with next possible options:

| # | parameter | option | value | description |
|---|-----------|--------|-------|-------------|
| 1 | XPI build folder | -d | work folder /zotero-build/xpi/build/zotero | previously built zotero core's folder |
| 2 | platform | -p | string from characters l, w and m | build to Linux / Windows / Mac platform. Giving more chars from set (l, w, m) means building to each given character's platform |
| 3 | XPI file | -f | path to XPI file | you can use this instead of passing built XPI folder by -d option |
| 4 | Channel | -c | | |
| 5 | Staging | -s | --- | Switch for building binaries into staging/ directory without packageing

Probably you'll have to create a symbolic link of zotero core folder into zotero-standalone-build directory:

```shell
ln -s ../zotero
```

Run command to build standalone:

```shell
./build.sh -p l -f ../zotero-build/xpi/build/zotero_patch-4.0.29.17.FETI-fx.xpi -c release
```

You'll get a 32-bit and a 64-bit standalone build for linux distributions into "staging" folder. You'll also get tarballs of them and a build_id file into "dist" folder.

# 6. Install Zotero Standalone

You can provide the software to the users by publishing the 32-bit and 64-bit standalone build tarballs belonging to corresponding platform(s).

# 6.1. Installing on linux platform

After extracting standalone build tarball on user's system, you can start it by double-clicking on zotero.desktop quick launch icon or executing zotero shell script.

User profile will be created at the first launch of the software (or installed Mozilla Firefox's Zotero extension and Mozilla profile folder can be used optionally).

After user profile is created, you should complete it with the exception of our self-signed certificate used for "local" S3 attachment upload. You have to create certificate override txt in your standalone profile folder. You can find it at path "~/.zotero/zotero/someId.default/", where "someId" is some random key string generated by Mozilla's xulrunner (usually 8 characters). You can check whether you are in appropriate folder by finding cert8.db file in the directory also.

Once you switched to correct profile folder, you have to create cert_override.txt with the next content:
```txt
# PSM Certificate Override Settings file
# This is a generated file!  Do not edit.
vogon.feti.hu:443	OID.2.16.840.1.101.3.4.2.1	0E:48:43:D1:DA:61:CF:E7:60:04:3B:F9:81:9A:D8:EA:36:BA:C4:40:AA:60:0A:76:B8:62:BA:4C:4B:DD:88:75	U	AAAAAAAAAAAAAAAEAAAArVisCpkwgaoxCzAJBgNVBAYTAkhVMQ0wCwYDVQQKEwRGRVRJMQwwCgYDVQQLEwNrZnQxETAPBgNVBAcTCEJ1ZGFwZXN0MRAwDgYDVQQIEwdIdW5nYXJ5MRYwFAYDVQQDEw12b2dvbi5mZXRpLmh1MR0wGwYKCZImiZPyLGQBARMNdm9nb24uZmV0aS5odTEiMCAGCSqGSIb3DQEJARYTZmV0aXRlc3p0QGdtYWlsLmNvbQ==
```


Zotero
======
[![Build Status](https://travis-ci.org/zotero/zotero.svg?branch=4.0)](https://travis-ci.org/zotero/zotero)

[Zotero](https://www.zotero.org/) is a free, easy-to-use tool to help you collect, organize, cite, and share your research sources.

Please post feature requests or bug reports to the [Zotero Forums](https://forums.zotero.org/). If you're having trouble with Zotero, see [Getting Help](https://www.zotero.org/support/getting_help).

For more information on how to use this source code, see the [Zotero wiki](https://www.zotero.org/support/dev/source_code).
