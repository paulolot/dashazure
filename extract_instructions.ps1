$transcriptPath = 'C:\Users\palot\.gemini\antigravity\brain\f603ac4a-e900-4c59-8b7a-03450b97de10\.system_generated\logs\transcript.jsonl'
$outPath = 'conversas\instrucoes.md'

$content = [System.IO.File]::ReadAllLines($transcriptPath, [System.Text.Encoding]::UTF8)

$output = "# Instruções do Usuário`r`n`r`n"
$counter = 1

foreach ($line in $content) {
    try {
        $json = $line | ConvertFrom-Json
        if ($json.type -eq 'USER_INPUT') {
            $text = $json.content
            if ($text -match '(?s)<USER_REQUEST>\s*(.*?)\s*</USER_REQUEST>') {
                $instruction = $matches[1].Trim()
                $output += "## Instrução $counter`r`n`r`n$instruction`r`n`r`n"
            } else {
                $output += "## Instrução $counter`r`n`r`n$($text.Trim())`r`n`r`n"
            }
            $counter++
        }
    } catch {
    }
}

[System.IO.File]::WriteAllText((Get-Location).Path + "\$outPath", $output, [System.Text.Encoding]::UTF8)
