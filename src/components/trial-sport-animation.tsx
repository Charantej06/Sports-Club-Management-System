import Image from "next/image";

const sports = ["padel", "tennis", "badminton", "cricket"];

export function TrialSportAnimation() {
  return (
    <div className="trial-sport-art" role="img" aria-label="Padel, tennis, badminton and cricket players">
      {sports.map((sport, index) => (
        <Image key={sport} src={`/images/trial-${sport}-gpt.png`} alt="" width={1254} height={1254} sizes="(max-width:479px) 150px, (max-width:767px) 140px, 240px" className={`trial-sport-image trial-pictogram trial-pictogram-${index}`} />
      ))}
    </div>
  );
}
