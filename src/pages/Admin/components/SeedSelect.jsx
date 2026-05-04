export const SEED_OPTIONS = Array.from({ length: 11 }, (_, value) => ({
  value: String(value),
  label: String(value),
}))

function SeedSelect({ seedNumber, value, onChange, id, name }) {
  return (
    <div className='seed'>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(event) => onChange(seedNumber, event.target.value)}
      >
        {SEED_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export default SeedSelect
