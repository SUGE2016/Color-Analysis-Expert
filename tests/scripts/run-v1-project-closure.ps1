param(
    [string]$ApiBase = "http://localhost:8080",
    [string]$FrontendBase = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$fixture = Join-Path $repoRoot "tests\fixtures\images\02_01_00.jpg"
$templateImage = Join-Path $repoRoot "algorithm-service\model_image.jpg"
$runSuffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$fixtureForCurl = Join-Path $env:TEMP "v1-fixture-$runSuffix.jpg"
$templateForCurl = Join-Path $env:TEMP "v1-template-$runSuffix.jpg"
Copy-Item -LiteralPath $fixture -Destination $fixtureForCurl
Copy-Item -LiteralPath $templateImage -Destination $templateForCurl
$records = [System.Collections.Generic.List[string]]::new()
$projectId = $null
$datasetId = $null
$datasetId2 = $null
$groupId = $null
$templateId = $null

function Record([string]$id, [bool]$passed, [string]$detail) {
    $status = if ($passed) { "PASS" } else { "FAIL" }
    $records.Add("$id|$status|$detail")
    Write-Host "[$status] $id - $detail"
}

function StatusCode([scriptblock]$request) {
    try {
        & $request | Out-Null
        return 200
    } catch {
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            return [int]$_.Exception.Response.StatusCode
        }
        throw
    }
}

try {
    $login = Invoke-RestMethod -Method Post -Uri "$ApiBase/api/auth/login" `
        -ContentType "application/json" -Body '{"username":"admin","password":"admin123"}'
    $headers = @{ Authorization = "Bearer $($login.token)" }
    Record "AUTH-01" ([bool]$login.token) "admin token acquired"

    $group = Invoke-RestMethod -Method Post -Uri "$ApiBase/api/dataset-groups" -Headers $headers `
        -ContentType "application/json" -Body (@{ name = "v1-plan-group-$runSuffix" } | ConvertTo-Json)
    $groupId = $group.id
    $dataset = Invoke-RestMethod -Method Post -Uri "$ApiBase/api/datasets" -Headers $headers `
        -ContentType "application/json" -Body (@{
            name = "v1-plan-dataset-$runSuffix"
            description = "V1 project closure test"
            ownerId = $login.userId
            groupId = $groupId
        } | ConvertTo-Json)
    $datasetId = $dataset.id
    $dataset2 = Invoke-RestMethod -Method Post -Uri "$ApiBase/api/datasets" -Headers $headers `
        -ContentType "application/json" -Body (@{
            name = "v1-plan-dataset-2-$runSuffix"
            description = "V1 unconfigured dataset test"
            ownerId = $login.userId
            groupId = $groupId
        } | ConvertTo-Json)
    $datasetId2 = $dataset2.id

    $authArg = "Authorization: Bearer $($login.token)"
    $uploadRaw = & curl.exe -s -X POST -H $authArg -F "file=@$fixtureForCurl" `
        "$ApiBase/api/datasets/$datasetId/images/upload"
    $uploaded = $uploadRaw | ConvertFrom-Json
    $uploadRaw2 = & curl.exe -s -X POST -H $authArg -F "file=@$fixtureForCurl" `
        "$ApiBase/api/datasets/$datasetId2/images/upload"
    $uploaded2 = $uploadRaw2 | ConvertFrom-Json
    $images = @(Invoke-RestMethod -Method Get -Uri "$ApiBase/api/datasets/$datasetId/images" -Headers $headers)
    $imageId = $images[0].id
    Record "DS-05" ([bool]$imageId) "fixture uploaded as image $imageId; response=$uploadRaw"

    $templateRaw = & curl.exe -s -X POST -H $authArg -F "name=v1-plan-template-$runSuffix" `
        -F "imageFile=@$templateForCurl" "$ApiBase/api/templates"
    $template = $templateRaw | ConvertFrom-Json
    $templateId = $template.id
    Record "TPL-01" ([bool]$templateId -and $template.imageAvailable) "image template created; response=$templateRaw"

    $baseConfig = @{
        analysisConfigVersion = 1
        description = "V1 closure"
        currentStep = 3
        correctionComplete = $false
        regions = @(@{
            regionId = "custom-region"
            name = "Custom Region"
            polygon = @(
                @{ x = 0.1; y = 0.1 }, @{ x = 0.9; y = 0.1 },
                @{ x = 0.9; y = 0.9 }, @{ x = 0.1; y = 0.9 }
            )
        })
        imageAnalysisConfig = @{}
    }
    $project = Invoke-RestMethod -Method Post -Uri "$ApiBase/api/projects" -Headers $headers `
        -ContentType "application/json" -Body (@{
            name = "v1-plan-project-$runSuffix"
            datasetIds = @($datasetId, $datasetId2)
            templateId = $templateId
            config = $baseConfig
        } | ConvertTo-Json -Depth 10)
    $projectId = $project.id
    Record "PRJ-01" ($project.status -eq "draft") "draft $projectId created"

    $reportBeforeRunCode = StatusCode {
        Invoke-WebRequest -Method Get -Uri "$ApiBase/api/reports/projects/$projectId/summary" `
            -Headers $headers -UseBasicParsing
    }
    Record "RPT-04" ($reportBeforeRunCode -eq 409) `
        "project without a successful Task returns 409"

    $tasksBefore = @(
        Invoke-RestMethod -Method Get -Uri "$ApiBase/api/projects/$projectId/tasks" -Headers $headers |
            Where-Object { $_ }
    ).Count
    $emptyRunCode = StatusCode {
        Invoke-WebRequest -Method Post -Uri "$ApiBase/api/projects/$projectId/run" -Headers $headers `
            -ContentType "application/json" -Body "{}" -UseBasicParsing
    }
    $tasksAfterEmpty = @(
        Invoke-RestMethod -Method Get -Uri "$ApiBase/api/projects/$projectId/tasks" -Headers $headers |
            Where-Object { $_ }
    ).Count
    Record "PRJ-06" ($emptyRunCode -eq 422 -and $tasksBefore -eq $tasksAfterEmpty) `
        "empty plan rejected with $emptyRunCode; tasks $tasksBefore->$tasksAfterEmpty"

    $correctedFile = Join-Path $env:TEMP "v1-corrected-$runSuffix.png"
    Invoke-WebRequest -Method Post -Uri "$ApiBase/api/projects/$projectId/corrections/$imageId" `
        -Headers $headers -ContentType "application/json" -Body "{}" -OutFile $correctedFile -UseBasicParsing
    $corrections = @(Invoke-RestMethod -Method Get -Uri "$ApiBase/api/projects/$projectId/corrections" -Headers $headers)
    $correction = $corrections | Where-Object { $_.imageId -eq $imageId }
    $previewFile = Join-Path $env:TEMP "v1-preview-$runSuffix.png"
    Invoke-WebRequest -Method Get -Uri "$ApiBase/api/projects/$projectId/corrections/$imageId/file" `
        -Headers $headers -OutFile $previewFile -UseBasicParsing
    Record "PRJ-11" ($correction.status -eq "completed" -and (Get-Item $previewFile).Length -gt 0) `
        "server correction persisted and restored"

    $boundaryConfig = $baseConfig.Clone()
    $boundaryConfig.correctionComplete = $true
    $boundaryConfig.currentStep = 4
    $boundaryConfig.imageAnalysisConfig = @{ $imageId = @{ "custom-region" = @("boundary_check") } }
    Invoke-RestMethod -Method Put -Uri "$ApiBase/api/projects/$projectId" -Headers $headers `
        -ContentType "application/json" -Body (@{
            name = $project.name
            datasetIds = @($datasetId, $datasetId2)
            templateId = $templateId
            config = $boundaryConfig
        } | ConvertTo-Json -Depth 10) | Out-Null
    $boundaryRunCode = StatusCode {
        Invoke-WebRequest -Method Post -Uri "$ApiBase/api/projects/$projectId/run" -Headers $headers `
            -ContentType "application/json" -Body "{}" -UseBasicParsing
    }
    $tasksAfterBoundary = @(
        Invoke-RestMethod -Method Get -Uri "$ApiBase/api/projects/$projectId/tasks" -Headers $headers |
            Where-Object { $_ }
    ).Count

    $configured = $baseConfig.Clone()
    $configured.correctionComplete = $true
    $configured.currentStep = 4
    $configured.imageAnalysisConfig = @{ $imageId = @{ "custom-region" = @("color_distribution") } }
    Invoke-RestMethod -Method Put -Uri "$ApiBase/api/projects/$projectId" -Headers $headers `
        -ContentType "application/json" -Body (@{
            name = $project.name
            datasetIds = @($datasetId, $datasetId2)
            templateId = $templateId
            config = $configured
        } | ConvertTo-Json -Depth 10) | Out-Null

    $legacyCode = StatusCode {
        Invoke-WebRequest -Method Post -Uri "$ApiBase/api/projects/$projectId/run" -Headers $headers `
            -ContentType "application/json" -Body '{"steps":["edge_hsv","edge_color"]}' -UseBasicParsing
    }
    $tasksAfterLegacy = @(
        Invoke-RestMethod -Method Get -Uri "$ApiBase/api/projects/$projectId/tasks" -Headers $headers |
            Where-Object { $_ }
    ).Count
    Record "PRJ-19" ($legacyCode -eq 422 -and $tasksAfterLegacy -eq $tasksBefore) `
        "legacy steps rejected with $legacyCode and no Task"

    $task = Invoke-RestMethod -Method Post -Uri "$ApiBase/api/projects/$projectId/run" -Headers $headers `
        -ContentType "application/json" -Body "{}"
    $taskId = $task.id
    $deadline = (Get-Date).AddMinutes(4)
    do {
        Start-Sleep -Seconds 2
        $task = Invoke-RestMethod -Method Get -Uri "$ApiBase/api/tasks/$taskId" -Headers $headers
    } while ($task.status -in @("queued", "running") -and (Get-Date) -lt $deadline)
    $finalProject = Invoke-RestMethod -Method Get -Uri "$ApiBase/api/projects/$projectId" -Headers $headers
    Record "PRJ-04" ($task.status -eq "success" -and $task.progress -eq 100 -and $finalProject.status -eq "completed") `
        "task=$($task.status), progress=$($task.progress), project=$($finalProject.status)"

    $params = $task.params | ConvertFrom-Json
    $result = $task.result | ConvertFrom-Json
    $planImages = @($params.analysisPlan.images)
    $manifest = @($result.imageManifest)
    Record "PRJ-15" ($planImages.Count -eq 1 -and $planImages[0].imageId -eq $imageId `
        -and $planImages[0].regions.Count -eq 1 -and $manifest[0].datasetId -eq $datasetId) `
        "only configured image/region present with datasetId + imageId"
    & docker exec color-api test -s "/app/storage/projects/$projectId/$taskId/analysis-plan.json"
    $planFileExists = $LASTEXITCODE -eq 0
    Record "PRJ-22" ($planFileExists -and $planImages[0].regions[0].regionId -eq "custom-region" `
        -and $planImages[0].regions[0].polygon.Count -eq 4) `
        "analysis-plan.json exists and contains the project normalized polygon"

    $fileKeys = @($result.files.PSObject.Properties.Name)
    $filesOk = $true
    foreach ($key in @("mainColorCsv", "mainColorNumberCsv", "entropyCsv")) {
        $path = $result.files.$key
        & docker exec color-api test -s $path
        if ($LASTEXITCODE -ne 0) { $filesOk = $false }
    }
    Record "PRJ-16" ($boundaryRunCode -eq 422 -and $tasksAfterBoundary -eq $tasksBefore `
        -and $filesOk -and $fileKeys -notcontains "edgeColorCsv") `
        "boundary_check rejected without Task; three fixed CSV outputs non-empty; edgeColorCsv absent"

    $summary = Invoke-RestMethod -Method Get -Uri "$ApiBase/api/reports/projects/$projectId/summary" -Headers $headers
    $previewRow = @($summary.preview.entropy)[0]
    Record "RPT-01" ($summary.stats.imageCount -eq 1 -and $previewRow.image_id -eq $imageId `
        -and $previewRow.dataset_id -eq $datasetId -and [bool]$previewRow.display_name `
        -and @($summary.images).Count -eq 1 -and $summary.images[0].imageId -eq $imageId) `
        "summary exposes the complete analyzed image list with stable identity"

    $single = Invoke-RestMethod -Method Get `
        -Uri "$ApiBase/api/reports/projects/$projectId/images/$imageId" -Headers $headers
    $singleRegion = @($single.regions)[0]
    Record "RPT-02" ($single.image.imageId -eq $imageId `
        -and @($single.regions).Count -eq 1 `
        -and @($singleRegion.colorDistribution).Count -gt 0 `
        -and @($singleRegion.mainColorNumber).Count -gt 0 `
        -and $null -ne $singleRegion.entropy.h `
        -and -not ($single.image.PSObject.Properties.Name -contains "label") `
        -and -not ($single.image.PSObject.Properties.Name -contains "originalUrl") `
        -and -not ($single.PSObject.Properties.Name -contains "sections")) `
        "single report joins three metrics and omits sample label and original-image URL"

    $reportCorrected = Join-Path $env:TEMP "v1-report-corrected-$runSuffix.png"
    Invoke-WebRequest -Method Get `
        -Uri "$ApiBase/api/reports/projects/$projectId/images/$imageId/file?variant=corrected" `
        -Headers $headers -OutFile $reportCorrected -UseBasicParsing
    $originalVariantCode = StatusCode {
        Invoke-WebRequest -Method Get `
            -Uri "$ApiBase/api/reports/projects/$projectId/images/$imageId/file?variant=original" `
            -Headers $headers -UseBasicParsing
    }
    & docker exec color-api test ! -e "/app/storage/projects/$projectId/$taskId/original"
    $originalDirectoryAbsent = $LASTEXITCODE -eq 0
    $snapshotFieldsClean = -not ($planImages[0].PSObject.Properties.Name -contains "label") `
        -and -not ($manifest[0].PSObject.Properties.Name -contains "label")
    Record "RPT-05" ((Get-Item $reportCorrected).Length -gt 0 `
        -and $originalVariantCode -eq 400 -and $originalDirectoryAbsent -and $snapshotFieldsClean) `
        "corrected snapshot is readable; original snapshot and sample label are absent"

    $singlePdf = Join-Path $env:TEMP "v1-single-report-$runSuffix.pdf"
    Invoke-WebRequest -Method Get `
        -Uri "$ApiBase/api/reports/projects/$projectId/images/$imageId/export?format=pdf" `
        -Headers $headers -OutFile $singlePdf -UseBasicParsing
    $pdfPrefix = [System.Text.Encoding]::ASCII.GetString(
        [System.IO.File]::ReadAllBytes($singlePdf)[0..3]
    )
    $badFormatCode = StatusCode {
        Invoke-WebRequest -Method Get `
            -Uri "$ApiBase/api/reports/projects/$projectId/images/$imageId/export?format=csv" `
            -Headers $headers -UseBasicParsing
    }
    $unconfiguredImageCode = StatusCode {
        Invoke-WebRequest -Method Get `
            -Uri "$ApiBase/api/reports/projects/$projectId/images/$($uploaded2.id)" `
            -Headers $headers -UseBasicParsing
    }
    Record "RPT-06" ((Get-Item $singlePdf).Length -gt 1000 -and $pdfPrefix -eq "%PDF" `
        -and $badFormatCode -eq 400 -and $unconfiguredImageCode -eq 404) `
        "single PDF generated; csv rejected with 400; unconfigured image rejected with 404"

    Invoke-RestMethod -Method Delete -Uri "$ApiBase/api/projects/$projectId" -Headers $headers | Out-Null
    $deletedProjectCode = StatusCode {
        Invoke-WebRequest -Method Get -Uri "$ApiBase/api/projects/$projectId" -Headers $headers -UseBasicParsing
    }
    & docker exec color-api test ! -e "/app/storage/projects/$projectId"
    $workspaceRemoved = $LASTEXITCODE -eq 0
    Record "PRJ-20" ($deletedProjectCode -eq 404 -and $workspaceRemoved) `
        "project, tasks and project workspace removed"
    $projectId = $null
} finally {
    if ($projectId) {
        try { Invoke-RestMethod -Method Delete -Uri "$ApiBase/api/projects/$projectId" -Headers $headers | Out-Null } catch {}
    }
    if ($templateId) {
        try { Invoke-RestMethod -Method Delete -Uri "$ApiBase/api/templates/$templateId" -Headers $headers | Out-Null } catch {}
    }
    if ($datasetId) {
        try { Invoke-RestMethod -Method Delete -Uri "$ApiBase/api/datasets/$datasetId" -Headers $headers | Out-Null } catch {}
    }
    if ($datasetId2) {
        try { Invoke-RestMethod -Method Delete -Uri "$ApiBase/api/datasets/$datasetId2" -Headers $headers | Out-Null } catch {}
    }
    if ($groupId) {
        try { Invoke-RestMethod -Method Delete -Uri "$ApiBase/api/dataset-groups/$groupId" -Headers $headers | Out-Null } catch {}
    }
}

$pass = @($records | Where-Object { $_ -match '\|PASS\|' }).Count
$fail = @($records | Where-Object { $_ -match '\|FAIL\|' }).Count
$timestamp = [DateTimeOffset]::Now.ToString("yyyy-MM-ddTHH:mm:sszzz")
$commit = (& git -c safe.directory=$repoRoot rev-parse --short HEAD)
$latest = @(
    "meta:",
    "  run_at: $timestamp",
    "  environment: docker",
    "  api_base: $ApiBase",
    "  frontend_base: $FrontendBase",
    "  script: tests/scripts/run-v1-project-closure.ps1",
    "  git_commit: $commit",
    "",
    "summary:",
    "  pass: $pass",
    "  fail: $fail",
    "  skip: 0",
    "  block: 0",
    "  total: $($records.Count)",
    "",
    "records:"
) + $records
$latest | Set-Content -Encoding UTF8 (Join-Path $repoRoot "tests\results\latest-run.txt")

if ($fail -gt 0) { exit 1 }
