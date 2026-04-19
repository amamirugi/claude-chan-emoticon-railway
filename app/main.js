import { App } from "@modelcontextprotocol/ext-apps";

// ─── 에셋 import (26종, 플랫 구조이므로 ../assets/) ───
import neutralImg from "../assets/neutral.webp";
import happyImg from "../assets/happy.webp";
import embarrassedImg from "../assets/embarrassed.webp";
import sadImg from "../assets/sad.webp";
import angryImg from "../assets/angry.webp";
import surprisedImg from "../assets/surprised.webp";
import loveImg from "../assets/love.webp";
import smugImg from "../assets/smug.webp";
import confusedImg from "../assets/confused.webp";
import cryingImg from "../assets/crying.webp";
import excitedImg from "../assets/excited.webp";
import proudImg from "../assets/proud.webp";
import scaredImg from "../assets/scared.webp";
import sleepyImg from "../assets/sleepy.webp";
import thinkingImg from "../assets/thinking.webp";
import tiredImg from "../assets/tired.webp";
import deadImg from "../assets/dead.webp";
import disappointedImg from "../assets/disappointed.webp";
import disgustedImg from "../assets/disgusted.webp";
import facepalmImg from "../assets/facepalm.webp";
import laughingImg from "../assets/laughing.webp";
import nervousImg from "../assets/nervous.webp";
import poutImg from "../assets/pout.webp";
import speechlessImg from "../assets/speechless.webp";
import winkImg from "../assets/wink.webp";
import chuImg from "../assets/chu.webp";

const loadingEl = document.getElementById("loading");
const imgEl = document.getElementById("emotion-img");
const labelEl = document.getElementById("label");

const images = {
  neutral: neutralImg, happy: happyImg,
  embarrassed: embarrassedImg, sad: sadImg,
  angry: angryImg, surprised: surprisedImg,
  love: loveImg, smug: smugImg,
  confused: confusedImg, crying: cryingImg,
  excited: excitedImg, proud: proudImg,
  scared: scaredImg, sleepy: sleepyImg,
  thinking: thinkingImg, tired: tiredImg,
  dead: deadImg, disappointed: disappointedImg,
  disgusted: disgustedImg, facepalm: facepalmImg,
  laughing: laughingImg, nervous: nervousImg,
  pout: poutImg, speechless: speechlessImg,
  wink: winkImg, chu: chuImg,
};

function showEmotion(emotion, label) {
  const src = images[emotion];
  if (src) {
    loadingEl.style.display = "none";
    imgEl.src = src;
    imgEl.style.display = "block";
  }
  if (label) labelEl.textContent = label;
}

const app = new App({ name: "emoticon-viewer", version: "1.0.0" });

app.ontoolresult = (result) => {
  const tag = result.content?.find(
    c => c.type === "text" && c.text.startsWith("__emotion__:")
  )?.text;
  const label = result.content?.find(
    c => c.type === "text" && !c.text.startsWith("__emotion__:")
  )?.text;
  if (tag) showEmotion(tag.replace("__emotion__:", ""), label);
};

// 스트리밍 중 미리 표시
app.ontoolinput = (input) => {
  if (input.arguments?.emotion)
    showEmotion(input.arguments.emotion, input.arguments?.description);
};

app.connect();
