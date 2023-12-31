# Example of WebRTC with Expo

`react-native-webrtc` is not available in Expo Go, that's why the [Expo Dev Client](https://docs.expo.dev/clients/introduction/) is used.

## How to run locally

1. Clone this repo
1. Install dependencies: `npm i`
1. Build locally: `npx expo run:android` 
1. Run app: Emmulator `npm run start` OR Real (connected) device `npm run start -- --tunnel`

## Notes

- [React Native WebRTC](https://github.com/react-native-webrtc/)
- [Expo Config Plugin: WebRTC](https://github.com/expo/config-plugins/tree/master/packages/react-native-webrtc)
- [Expo Development Client docs](https://docs.expo.dev/clients/introduction/)
- [Building with EAS](https://docs.expo.dev/eas/)



## build error

npx expo prebuild --clean
npx expo run:android

## build apk

mkdir android/app/src/main/assets/ && react-native bundle --platform android --dev true --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res

cd android

gradlew assembleDebug

android/build.gradle

```
subprojects { subproject ->
    afterEvaluate{
        if((subproject.plugins.hasPlugin('android') || subproject.plugins.hasPlugin('android-library'))) {
            android {
                compileSdkVersion rootProject.ext.compileSdkVersion
                buildToolsVersion rootProject.ext.buildToolsVersion
            }
        }
    }
}
```