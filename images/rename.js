// rename.js
import fs from 'fs';
import path from 'path';

// (1) 기존에 주어진 배열 복붙
const originWords = [
    "배윤찬", "최우식", "신현준", "송준성", "이정기", "정세욱", "김인환", "이우정", "임채을", "김우석",
    "조원준", "조여정", "황인선", "김동욱", "김수현", "김지은", "송진규", "조성연", "김민중", "인수빈",
    "배지수", "표가은", "문경혁", "이상효", "신상섭", "배성민", "정현정", "김소희", "이승민", "김남균",
    "최용수", "구희섭", "정민지", "정성화", "강부민", "김지현", "성승연", "이유정", "한솔", "한세진",
    "채승표", "이명규", "이주이", "하민우", "윤명준", "윤윤성", "신윤아", "전아름", "선면호", "안현서",
    "한향련", "신효경", "윤수영", "이예진", "전서영", "노경래", "김효경", "문지희", "장하영", "오하윤",
    "김지수", "김은우", "오채원", "박기웅", "임용대", "최이경", "최수완", "정하진", "최승진", "김대희",
    "이다혜", "황진아", "김민아", "민경은", "박아름", "김한나", "이애리", "권소연", "김누리", "이종민",
    "김하정", "송가원", "최민기", "김이슬", "전진희", "윤수빈", "이민욱", "이은택", "장범석", "우경민",
    "정대교", "서석", "홍혜빈", "이진호", "김준규", "선하은", "심유경", "정민정", "최준용", "박동수"
];

const originTexts = [
    "Bae Younchan", "Choi Woosik", "Shin Hyunjun", "Song Junseong", "Lee Jungki", "Chung Sewook", "Kim Inhwan", "Lee Woojeong",
    "Lim Chaeeul", "Kim Woosuk", "Cho Wonjun", "Cho Yuhjung", "Hwang Insun", "Kim Dongwook", "Kim Suhyun", "Kim Jieun",
    "Song Jinkyu", "Cho Sungyeon", "Kim Minjoong", "In Subin", "Bae Jisu", "Pyo Gaeun", "Moon Kyunghyuk", "Lee Sanghyo",
    "Shin Sangseop", "Bae Seongmin", "Jeong Hyeonjeong", "Kim Sohie", "Lee Seungmin", "Kim Namkyun", "Choi Yongsoo", 
    "Gu Heesub", "Jung Minji", "Jung Sunghwa", "Kang Bumin", "Kim Jihyeon", "Sung Seungyeon", "Lee Yujeong", "Han Sol",
    "Han Sejin", "Chae Seoungpyo", "Lee Myeonggyu", "Lee Juyi", "Ha Minu", "Yoon Myoungjune", "Youn Younsong", "Shin Yuna",
    "Jeon Areum", "Seon Myeonho", "Ahn Hyeonseo", "Han Hyangryeon", "Shin Hyokyeong", "Yun Suyoung", "Lee Yejin", "Jeon Seoyoung",
    "Noh Kyeongrae", "Kim Hyogyeong", "Moon Jihee", "Jang Hayoung", "Oh Hayun", "Jisue Kim", "Kim Eunwoo", "Oh Chaewon", 
    "Park Giwoong", "Lim Yongdae", "Choi Likyoung", "Choi Soowan", "Jung Hajin", "Choi Seungjin", "Kim Daehee", "Lee Dahye",
    "Hwang Jina", "Kim Mina", "Min Kyoungeun", "Park Areum", "Kim Hanna", "Lee Aeri", "Kwon Soyeon", "Kim Nuri", "Lee Jongmin",
    "Kim Hajung", "Song Gawon", "Choi Minki", "Kim Eeseul", "Jeon Jinhee", "Yoon Subin", "Lee Minuk", "Lee Euntaeg", 
    "Jang Beomseok", "Woo Kyungmin", "Jeong Daekyo", "Seo Seok", "Hong Hyebin", "Lee Jinho", "Kim Jungyu", "Sun Haeun", 
    "Sim Yukyoung", "Jung Minjung", "Choi Junyong", "Park Dongsoo"
];

// (2) 실제 파일이 위치한 폴더 (현재 스크립트를 실행하는 폴더라면 ".")
const folderPath = ".";

// (3) 반복문으로, originWords[i] → originTexts[i] 로 rename
for (let i = 0; i < originWords.length; i++) {
  // 한글 파일명 + 확장자
  const oldName = originWords[i] + ".png"; // 혹은 ".jpg", ".pmg" 등
  // 영문 이름에서 공백 제거
  const newNameBase = originTexts[i].replace(/\s+/g, "");
  const newName = newNameBase + ".png";

  const oldPath = path.join(folderPath, oldName);
  const newPath = path.join(folderPath, newName);

  // (4) rename 시도
  try {
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
      console.log(`Renamed: ${oldName} → ${newName}`);
    } else {
      console.warn(`File not found: ${oldName}`);
    }
  } catch (err) {
    console.error(`Error renaming ${oldName} → ${newName}:`, err);
  }
}
