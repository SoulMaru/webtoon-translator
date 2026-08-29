/** 작업실 컴퓨터가 꺼져 있을 때 방문자가 보는 화면. */
export default function ClosedNotice() {
  return (
    <div className="blank">
      <div className="seal" aria-hidden="true">새김</div>
      <h1>지금은 공방 문을 닫았습니다</h1>
      <p>
        작품은 작업실 컴퓨터에 그대로 있습니다.
        컴퓨터를 켜면 이 자리에 다시 걸립니다.
      </p>
      <p className="quiet">잠시 뒤 새로고침해 주십시오.</p>
    </div>
  );
}
