import React, { useState } from 'react'
import { SafeAreaView, StyleSheet, View, Button, Text, Image, Alert, TouchableOpacity, Platform, NativeEventEmitter } from 'react-native'
import { launchImageLibrary } from 'react-native-image-picker'
import * as RNFS from 'react-native-fs'
import FaceSDK, { Enum, FaceCaptureResponse, LivenessResponse, MatchFacesResponse, MatchFacesRequest, MatchFacesImage, ComparedFacesSplit, InitConfig, InitResponse, LivenessSkipStep, SearchPerson, RNFaceApi, LivenessNotification } from '@regulaforensics/react-native-face-api'

type State = {
  img1?: any
  img2?: any
  similarity?: string
  liveness?: string
}

var image1 = new MatchFacesImage()
var image2 = new MatchFacesImage()

export default function App() {
  const [face, setFace] = useState<State>({
    img1: require('./images/portrait.png'),
    img2: require('./images/portrait.png'),
    similarity: "nil",
    liveness: "nil"
  })

  const eventManager = new NativeEventEmitter(RNFaceApi)

  eventManager.addListener('livenessNotificationEvent', data => {
    const notification = LivenessNotification.fromJson(JSON.parse(data))!
    console.log("LivenessStatus: " + notification.status)
  })

  const onInit = (json: string) => {
    const response = InitResponse.fromJson(JSON.parse(json))

    if (!response!.success) {
      console.log(response!.error!.code);
      console.log(response!.error!.message);

      return 
    }

    console.log("Init complete")
  };

  const licPath = Platform.OS === 'ios' ? (RNFS.MainBundlePath + "/license/regula.license") : "regula.license"

  const readFile = Platform.OS === 'ios' ? RNFS.readFile : RNFS.readFileAssets

  readFile(licPath, 'base64').then((license) => {
    const config = new InitConfig();

    config.license = license

    FaceSDK.initialize(config, onInit, (_e: any) => { })
  }).catch(_ => {
    FaceSDK.initialize(null, onInit, (_e: any) => { })
  })

  const setImage = (first: boolean, base64: string, type: number) => {
    if (base64 == null) return
    setFace({ similarity: "null" })
    if (first) {
      image1 = new MatchFacesImage()
      image1.image = base64
      image1.imageType = type
      setFace({ img1: { uri: "data:image/png;base64," + base64 } })
      setFace({ liveness: "null" })
    } else {
      image2 = new MatchFacesImage()
      image2.image = base64
      image2.imageType = type
      setFace({ img2: { uri: "data:image/png;base64," + base64 } })
    }
  }

  const pickImage = (first: boolean) => {
    Alert.alert("Select option", "", [
      {
        text: "Use gallery",
        onPress: () => launchImageLibrary({
          mediaType: 'photo',
          selectionLimit: 1,
          includeBase64: true
        }, (response: any) => {
          if (response.assets == undefined) return
          setImage(first, response.assets[0].base64!, Enum.ImageType.PRINTED)
        })
      },
      {
        text: "Use camera",
        onPress: () => FaceSDK.startFaceCapture(null, (json: string) => {
          var response = FaceCaptureResponse.fromJson(JSON.parse(json))!
          if (response.image != null && response.image.image != null)
            setImage(first, response.image.image, Enum.ImageType.LIVE)
        }, _e => { })
      }], { cancelable: true })
  }

  const clearResults = () => {
    setFace({ img1: require('./images/portrait.png') })
    setFace({ img2: require('./images/portrait.png') })
    setFace({ similarity: "null" })
    setFace({ liveness: "null" })
    image1 = new MatchFacesImage()
    image2 = new MatchFacesImage()
  }

  const matchFaces = () => {
    if (image1 == null || image1.image == null || image1.image == "" || image2 == null || image2.image == null || image2.image == "")
      return
    setFace({ similarity: "Processing..." })
    var request = new MatchFacesRequest()
    request.images = [image1, image2]
    FaceSDK.matchFaces(request, null, (json: string) => {
      var response = MatchFacesResponse.fromJson(JSON.parse(json))
      FaceSDK.splitComparedFaces(response!.results!, 0.75, str => {
        var split = ComparedFacesSplit.fromJson(JSON.parse(str))!
        setFace({ similarity: split.matchedFaces!.length > 0 ? ((split.matchedFaces![0].similarity! * 100).toFixed(2) + "%") : "error" })
      }, e => { setFace({ similarity: e }) })
    }, e => { setFace({ similarity: e }) })
  }

  const liveness = () =>  {
    FaceSDK.startLiveness({ skipStep: [LivenessSkipStep.ONBOARDING_STEP] }, (json: string) => {
      var response = LivenessResponse.fromJson(JSON.parse(json))!
      if (response.image != null) {
        setImage(true, response.image, Enum.ImageType.LIVE)
        setFace({ liveness: response.liveness == Enum.LivenessStatus.PASSED ? "passed" : "unknown" })
      }
    }, _e => { })
  }

  return (
    <SafeAreaView style={styles.container}>

      <View style={{ padding: 15 }}>
        <TouchableOpacity onPress={() => pickImage(true)} style={{ alignItems: "center" }}>
          <Image source={face.img1} resizeMode="contain" style={{ height: 150, width: 150 }} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => pickImage(false)} style={{ alignItems: "center" }}>
          <Image source={face.img2} resizeMode="contain" style={{ height: 150, width: 200 }} />
        </TouchableOpacity>
      </View>

      <View style={{ width: "100%", alignItems: "center" }}>
        <View style={{ padding: 3, width: "60%" }}>
          <Button title="Match" color="#4285F4" onPress={matchFaces} />
        </View>
        <View style={{ padding: 3, width: "60%" }}>
          <Button title="Liveness" color="#4285F4" onPress={liveness} />
        </View>
        <View style={{ padding: 3, width: "60%" }}>
          <Button title="Clear" color="#4285F4" onPress={clearResults} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', padding: 10 }}>
        <Text>Similarity: {face.similarity}</Text>
        <View style={{ padding: 10 }} />
        <Text>Liveness: {face.liveness}</Text>
      </View>
    </SafeAreaView>
  )
}


const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
    marginBottom: 12,
  },
});
