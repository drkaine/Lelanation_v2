local cost = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local count = redis.call('ZCARD', KEYS[1])

if count < cost then
  local last = redis.call('ZRANGE', KEYS[1], -1, -1, 'WITHSCORES')
  local waitMs = 1500
  if #last > 0 then
    waitMs = math.max(100, tonumber(last[2]) - now + 100)
  end
  return {0, waitMs}
end

local slots = redis.call('ZPOPMIN', KEYS[1], cost)
local fireAt = now
for i = 2, #slots, 2 do
  fireAt = math.max(fireAt, tonumber(slots[i]))
end

return {1, fireAt}
