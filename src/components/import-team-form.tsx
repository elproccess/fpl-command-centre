export function ImportTeamForm() {
  return (
    <form
      action="/api/import-team"
      method="post"
      className="rounded-2xl border border-[#E8DEF8] bg-white p-5 shadow-[0_18px_45px_rgba(55,0,60,0.08)]"
    >
      <label htmlFor="team-id" className="text-sm font-black text-[#17002F]">
        FPL Team ID
      </label>

      <input
        id="team-id"
        name="team_id"
        inputMode="numeric"
        required
        placeholder="Enter your FPL Team ID"
        className="mt-3 w-full rounded-xl border border-[#E8DEF8] bg-white px-4 py-3 font-semibold text-[#17002F] outline-none transition placeholder:text-[#8B7A9B] focus:border-[#6C1DFF]"
      />

      <label htmlFor="gameweek" className="mt-4 block text-sm font-black text-[#17002F]">
        Gameweek <span className="font-semibold text-[#8B7A9B]">(optional — auto-resolved)</span>
      </label>

      <input
        id="gameweek"
        name="gameweek"
        inputMode="numeric"
        placeholder="Leave blank for latest squad snapshot"
        className="mt-3 w-full rounded-xl border border-[#E8DEF8] bg-white px-4 py-3 font-semibold text-[#17002F] outline-none transition placeholder:text-[#8B7A9B] focus:border-[#6C1DFF]"
      />

      <button
        type="submit"
        className="mt-4 w-full rounded-xl bg-[#6C1DFF] px-4 py-3 font-black text-white transition hover:bg-[#5A16DF]"
      >
        Import team
      </button>
    </form>
  );
}